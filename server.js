"use strict";

require('dotenv').config();

const PORT        = process.env.PORT || 8080;
const ENV         = process.env.ENV || "development";
const cookieSession = require('cookie-session');
const express     = require("express");
const bodyParser  = require("body-parser");
const sass        = require("node-sass-middleware");
const app         = express();

const knexConfig  = require("./knexfile");
const knex        = require("knex")(knexConfig[ENV]);
const morgan      = require('morgan');
const knexLogger  = require('knex-logger');
// const goodread    = require('./public/scripts/app');

// Seperated Routes for each Resource
const usersRoutes       = require("./routes/users");

const PiranhaxProvider   = require('./api/piranhax.js');
const GoodreadsProvider  = require('./api/goodread.js');
const MovieDBProvider    = require('./api/moviedb.js');
const YelpProvider       = require('./api/yelp.js');

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan('dev'));

// Log knex SQL queries to STDOUT as well
app.use(knexLogger(knex));

app.use(cookieSession({
  name: 'session',
  keys: ['123'],
  maxAge: 24 * 60 * 60 * 1000
}))
app.use(function(req, res, next){
  req.user = req.session.user_id;
  next();
});

//
// app.use('/*?', (req, res, next) => {
//   if (req.user) {
//     next();
//   } else {
//     res.status(401).send('You must <a href="/login">Sign In</a> before you can enter this page. <br><br>Or you can <a href="/register">Register Here</a>');
//   }
// });

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/styles", sass({
  src: __dirname + "/styles",
  dest: __dirname + "/public/styles",
  debug: true,
  outputStyle: 'expanded'
}));
app.use(express.static("public"));

// Mount all resource routes
app.use("/api/users", usersRoutes(knex));

// Set Cookie Username & Login Handler
app.post('/login', (req, res) => {
  // select * from users where user_name = 'michael';
  knex.select().from('users').where('user_name', req.body.name).then(function (results) {
    // console.log('user results: ', results)
    if (results.length !== 1 || results[0].password !== req.body.password) {
      res.send('Please <a href="/register">Sign-in</a> with a correct user name and password.\n Or you can <a href="/register">Register here</a> for a new account.', 401);
      return
    } else {
      req.session.user_id = results[0].id;
      res.redirect('/');
    }
  }).catch(function (err) {
    res.status(500).send("oh crap.  see whatever...");
  });
});

// Clear Cookie Logout
app.post('/logout', (req, res) => {
  req.session.user_id = '';
  res.redirect('/register');
});

// Register page
app.get("/register", (req, res) => {
  if (req.user) {
    res.redirect('/');
  }
  // console.log("user_id", req.user);
  res.render("register");
});

app.post("/register", (req, res) => {
  const user_name = req.body.name;
  const password = req.body.password;
  knex.select().from('users').where('user_name', req.body.name)
  .then((results) => {
    if(results.length === 0) {
      return knex('users')
      .insert({'user_name': user_name, 'password': password})
      .returning('id');
    } else {
      // if the users exists already then inform.
      console.log('user already exists');
      // alert("Hello! I am an alert box!");
      res.redirect("register");
    }
  })
  .then((results) => {
    // console.log("hopefully the new userid is in this: ", results);
    if (results.length !== 1) {
      console.log("what the hell is with this non-length-1 result: ", results);
      res.status(500).send("oh crap.  see server log.");
        return;
      }
      req.session.user_id = results[0];
      res.redirect("register");  // TODO: better redirect
  })
  .catch((err) => {
    if (err) {
      console.log(err);
      res.status(500).send("oh crap.  see server log.");
      return;
    }
  });
});


//Profile page
app.get("/profile", (req, res) => {
  //Make sure user is logged in
  if (!req.user) {
    res.status(401).send("You're not logged in");
  } else {
    res.render('profile');
    }
});

//Editing profile
app.put("/profile", (req, res) => {

  const newName = req.body.name;
  const newPassword = req.body.password;

  //Make sure user is logged in
  if (!req.user) {
    res.status(401).send("You're not logged in");
  } else {

    //If any fields are empty, send error
    if (!req.body.name || !req.body.password) {
      res.status(400).send("All fields must be filled.");
      return;
    } else {

      //Otherwise, change user account info
      knex.select().table('users')
      .where({ id: req.user })
      .update({'user_name': newName, 'password': newPassword})
      .catch(function(error) {
        console.error("There was an Error", error);
      });
      res.json({
        success: "succesfully updated"
      });
    }
  }
});


//Save todo to database
app.post("/save", (req, res) => {

  // These are the variables to be inserted through knex
  // To database
  let savedTodo = req.body.name;
  let savedCategory = req.body.category;
  let apiSource = req.body.apiSource;
  let doneStatus = req.body.done_status;
  let userId = req.body.userId;
console.log("req.body:", req.body)
  //Inserting here
  console.log('Successfully Inserted before knex!')
  knex.select().table('todos')
    .insert( {'todo_item': savedTodo, 'todo_catagory': savedCategory, 'api_source': apiSource, 'done_status': doneStatus, 'user_id': userId })
    .then(function(){
      console.log('Successfully Inserted')
      res.redirect('/');
    })
    .catch((err) => {
      if (err) {
        console.log(err);
        res.status(500).send("Sorry, there was an error");
        return;
      }
  });
});


// Home page
app.get("/", (req, res) => {
  if (req.user) {
    console.log('user id is:', req.user)

    knex.select('user_name').from('users').where('id', req.user)
      .then((results) => {
        console.log("hopefully the new userid is in this: ", results, 'id: ', req.user);
        if (results.length !== 1) {
          console.log("what the hell is with this non-length-1 result: ", results);
          res.status(500).send("oh crap.  see server log.");
            return;
        }
        var user_name = results[0].user_name;

        // We need this

        knex.select().from('todos').where('user_id', req.user).then(function(results){
          if(undefined){
          console.log("Shit user_id is undefined: ", results);
          res.status(500).send("results undefined for user_id!!");
            return;
          }else

          var realTodo_array = [];
          results.forEach(function(todoRow){
              var realTodo_items = {};

              var name = todoRow.todo_item;
              var category = todoRow.todo_catagory;
              var source = todoRow.api_source;
              var query = todoRow.todo_query;
              //
              var done  = todoRow.done_status;


              realTodo_items.name = name;
              realTodo_items.category = category;
              realTodo_items.source = source;
              // realTodo_items.api_source = api_source;
              realTodo_array.push(realTodo_items)

             // console.log('From the DATABASE: =>', todoRow.todo_item)
          })
          // console.log('realTodo_array=>\n', realTodo_array)
                  // console.log(results[0].user_name);
        // console.log("I hate everything about you -- Ugly Kid Joe");
        // TODO here pass to function insert

          let templateVar = {
            //todo fix this so that a name will show in the username field on index.ejs nav
            user_name: user_name,
            user_id: req.user,
            //This is our object to send to FRont End!!!
            // Variable for frontend
            todo_items: realTodo_array
          };

          console.log('realTodo_array=>\n', realTodo_array)
          //TODO display all content from todos table for a user

          res.render("index", templateVar);
        })
      }
    );
  } else {
    res.redirect("register");
  }
});

app.post("/search", (req, res) => {
  const term = req.body.search;
  if (!term) {
    res.status(401).send('You left the input box empty when you submitted. <br><br> Please try again <a href="/">here</a>');
    return;
  } else {
    // from http://stackoverflow.com/questions/31424561/wait-until-all-es6-promises-complete-even-rejected-promises
    function reflect(promise){
      return promise.then(function(v){ return {v:v, status: "resolved" }},
                          function(e){ return {e:e, status: "rejected" }});
    }

    var allData = Promise.all([

      GoodreadsProvider.search(term),
      YelpProvider.search(term),
      MovieDBProvider.search(term),
      PiranhaxProvider.search(term)
    ].map(reflect))//.then(console.log('from app.post in Server:', data))
    // .then(data => res.send(data));
    .then(function(apiResponses){

      let goodReadsResponse;

      console.log('apiResponses:', apiResponses);

      if (apiResponses[0].e) {
        goodReadsResponse = { }; // dummy data to deal with error in API call
      } else {
        goodReadsResponse = apiResponses[0];
      }

      // let todo_item_id = Math.floor(Math.random() * 60) + 10;
      // let cataOptions = Math.floor((Math.random() * 4) + 1);
      // let category = "";
      // switch (cataOptions) {
      //     case 1:
      //         category = "Books";
      //         break;
      //     case 2:
      //         category = "Food";
      //         break;
      //     case 3:
      //         category = "Movies";
      //         break;
      //     case 4:
      //         category = "Products";
      // }

      //Category as determined by Amazon
      let todoCategory = goodReadsResponse.v.category;

      //Compare against Yelp for todo items that are neither movies or books
      if ((todoCategory !== "Movie/TV Series") && (todoCategory !== "Book")) {

        //Query Yelp through their API

        YelpProvider.search(term).then(function(yelpResult) {

          //Send Yelp results if todo item matches a restaurant
          if (yelpResult.title.toLowerCase().includes(term.toLowerCase())) {

            todoCategory = yelpResult.category;
            name = yelpResult.title;
            source = yelpResult.source;

            let outgoingResponse = {
              name: name,
              category: todoCategory,
              source: source,
              todo: term
            };

            res.json(outgoingResponse);


          } else {

            //Send Amazon "product" results if Yelp is null
            let todoCategory = goodReadsResponse.v.category;
            var name = goodReadsResponse.v.title;
            var source = goodReadsResponse.v.source;
            var author = goodReadsResponse.v.author;
            // goodReadsResponse.v.title

            let outgoingResponse = {
              name: name,
              category: todoCategory,
              source: source,
              todo: term
            };

            console.log('goodReadsResponse: ', goodReadsResponse);

            res.json(outgoingResponse);
         }
       })
     } else {
        //Send Amazon "movie" or "book" results if above conditions not met
        let todoCategory = goodReadsResponse.v.category;
        var name = goodReadsResponse.v.title;
        var source = goodReadsResponse.v.source;
        var author = goodReadsResponse.v.author;
        // goodReadsResponse.v.title

        let outgoingResponse = {
          name: name,
          category: todoCategory,
          source: source,
          todo: term
        };

        console.log('goodReadsResponse: ', goodReadsResponse);

        res.json(outgoingResponse);
     }

   })
    .catch(function(error){
      console.log("I thought we reflected until this stopped happening?", error);
      res.json({
        error: "not the bees" // TODO: don't be like Jeremy.  no one likes Nick Cage
      });
    });

    // for each provider available
    // provider.search(term).then(data) => store data
    // return all data from all providers
    // res.redirect('/');
  }
});

app.listen(PORT, () => {
  console.log("Example app listening on port " + PORT);
});
