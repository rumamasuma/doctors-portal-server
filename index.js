const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');

const port = process.env.PORT || 5000;

// firebase admin

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors());
app.use(express.json());
// connection to database

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qaigm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// verify firebase token
async function verifyToken(req, res, next){
if(req.headers?.authorization?.startsWith('Bearer ')) {
  const token = req.headers.authorization.split(' ')[1];

  try{
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
  }
  catch{

  }
}
  next();
}



async function run(){
try{
    await client.connect();
        //  console.log('database connected successfully');
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        // GET api using email
app.get('/appointments' ,verifyToken, async(req, res)=>{
  const email = req.query.email;
  const date = new Date(req.query.date).toLocaleDateString();
  // console.log(date);
  const query = {email: email , date : date};
  // console.log(query);
  const cursor = appointmentsCollection.find(query);
  const appointments = await cursor.toArray();
  res.json(appointments);
})
      // POST api
      app.post('/appointments' , async(req, res) =>{
        const appointment = req.body;
        // console.log(appointment);
        const result = await appointmentsCollection.insertOne(appointment);
        res.json(result);
      })
// search admin
app.get('/users/:email', async(req, res) =>{
  const email = req.params.email;
  const query = {email : email};
  const user = await usersCollection.findOne(query);
 let isAdmin = false;
  if(user?.role === 'admin'){
    isAdmin = true;
  }
  res.json({admin : isAdmin});
})


// POST users 
app.post('/users', async(req, res)=>{
  const user = req.body;
  const result = await usersCollection.insertOne(user);
  console.log(result);
  res.json(result);
})
// update & insert = upsert API
app.put('/users' , async (req, res) =>{
  const user= req.body;
  const filter = {email : user.email};
  const options = {upsert : true};
  const updateDoc = {$set : user};
  const result = await usersCollection.updateOne(filter,updateDoc, options);
  res.json(result);
})

// make admin
app.put('/users/admin',verifyToken, async(req, res) => {
  const user = req.body;
  // console.log('authorization check', req.headers.authorization);
  // console.log('put', req.decodedEmail);
  const requester = req.decodedEmail;
  if(requester){
    const requesterAccount = await usersCollection.findOne({email : requester});
    if(requesterAccount.role === 'admin'){
      const filter = {email : user.email};
      const updateDoc = {$set:{role : 'admin'}};
      const result = await usersCollection.updateOne(filter , updateDoc);
      res.json(result);
    }
  }
 else{
   res.status(403).json({message : 'you do not have access to make admin.'})
 }

})
}

finally {
    // await client.close();
}
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello FROM  DOCTORS PORTAL !')
})

app.listen(port, () => {
  console.log(` Listening at ${port}`)
})