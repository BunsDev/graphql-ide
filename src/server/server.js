const express = require('express')
require('dotenv').config()
const path = require('path')
const cors = require('cors')
const mysql = require('mysql')
const dbconfig = require('./databaseConfig')
const db = mysql.createPool({
  ...dbconfig.connection,
  'connectionLimit': 10,
  'database': dbconfig.database
})
const app = express()
const cookieSession = require('cookie-session')
const bodyParser = require('body-parser')
const passport = require('passport')
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, '../../build')))
app.use(cors())
app.use(cookieSession({
    name: 'mysession',
    keys: ['vueauthrandomkey'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours 
  }))
app.use(passport.initialize());
app.use(passport.session());

require('./passport')(passport, db)
require('./endPoints')(app, passport, db)

if (process.env.NODE_ENV==='production') {
  app.get('*', (req,res) => {
    res.sendFile(path.join(__dirname, '../../build/index.html'))
  })
} 

app.listen(4000, () => {
	console.log("Example app listening on port 4000")
})