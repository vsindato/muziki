const express = require('express');
const request = require('request');
const path = require('path');
const querystring = require('querystring');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
var config = require('./config');

const app = express();

const port = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));


// middleware
app.use(express.static(__dirname + '/static'))
   .use(cookieParser())
   .use(bodyParser.urlencoded({
     extended: false
   }))
   .use(bodyParser.json());

// routing middleware
app.use('/', routes());

// Spotify credentials
var client_id = '3d7a0dfbde4c48c5ac51acb1f30e6b6c'; // Your client id
var client_secret = '609c7eb39b5141438000355e6c846e60'; // Your secret
var redirect_uri = `http://localhost:${port}/redirect`; // Your redirect uri

// Songkick credentials
var songkick_api_key = 'XXXXXXXXXX';

/*
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';


app.get('/login', (req, res) => {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  var scope = 'user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    })
)
})

app.get('/redirect', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;
  console.log("state:", state, "storedState:", storedState);
  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me/top/artists',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          var artists = [];
          for (i = 0; i < body.items.length; i++) {
            artists.push(body.items[i]['name']);
          }
          res.render('pages/index', {greeting: 'Muziki', artists: artists});
        });

        // we can also pass the token to the browser to make requests from there
        // res.redirect('/#' +
        //   querystring.stringify({
        //     access_token: access_token,
        //     refresh_token: refresh_token
        //   }));


      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

// separate function for making request to songkick

app.get('/artist/:name', function (req, res) {

  var artist_name = req.params.name;

  var options = {
    url: 'https://api.songkick.com/api/3.0/search/artists.json' ,
    qs: {'apikey': songkick_api_key, 'query': artist_name},
    json: true
  };

  // guess: request library uses callbacks so stick with callbacks
  request.get(options, function(error, response, body) {

    if (error) {
      console.log("Error after calling songkick:", error)
    } else {
      console.log(body)
      var namesakes = body.resultsPage.results.artist;

      for (i=0; i<namesakes.length; i++) {
        if (artist_name.toLowerCase() === namesakes[i].displayName.toLowerCase()){
          var artistId = namesakes[i].id;
          getCalendar(artistId, function(error, calendar){
            if (error) {
              console.log("Request to artist\'s calendar failed")
            } else {
              res.render('pages/calendar', {artist: artist_name, artistEvents: calendar});
            }
          });
        }
      }

    };

  });

});


function getCalendar(artistId, callback) {
  // api_endpoint & access_key
  var options = {
    url: `https://api.songkick.com/api/3.0/artists/${artistId}/calendar.json`,
    qs: {'apikey': songkick_api_key},
    json: true
  };

  // api request to songkick's artist calendar api
  request.get(options, function(error, response, body) {
    if (error) {
      callback(true, null)
    } else {
      var events = body.resultsPage.results.event;
      callback(false, events);
    }
  });

}

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
