var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var knex = require('knex');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
//adding in user authentication with sessions
// app.use(bodyParser());
app.use(cookieParser('random'));
app.use(session({
  secret: "random",
  resave: false,
  saveUninitialized: true
}));

function restrict(req, res, next){
  if (req.session.User){
    next();
  } else{
    req.session.error = "access denied";
    res.redirect('/login');
  }
};

app.get('/', restrict, function(req, res) {
  res.render('index');
});

app.get('/create', restrict, function(req, res) {
  res.render('index');
});

app.get('/links', restrict, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});



/************************************************************/
// Write your dedicated authentication routes here
// e.g. login, logout, etc.
/************************************************************/

//when we get a request to our localhost check if user is loggged in.
  //possibly check with sessions.
  //if user is logged in send to index
  //if user is not logged in redirect to login page.
app.get('/login', function (req, res){
  res.render('login');
});

app.get('/signup', function (req, res){
  res.render('signup');
});

app.post('/signup', function (req, res){
    var user = req.body.username;
    var password = req.body.password;
  
  var newUser = new User({
      username: user,
      password: password
    }).save()
      .then(function(attr) {
        Users.add(attr);
        res.send(200, attr);
      });

    req.session.User = user;
    res.redirect('/');

});

app.post('/login', function (req, res){
  var user = req.body.username;

  new User({'username': user}).fetch()
   .then( function( found ) {
    console.log( found )
      if ( found ) {
        req.session.User = user;
        res.redirect('/');
      } else {
        res.redirect( '/login' );
      }
    });
  
});

app.get('/logout', function (req, res){
    req.session.destroy(function(){
        res.redirect('/');
    });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
