const express = require('express');

const artistsRoute = require('./artists')
const tracksRoute = require('./tracks')


const router = express.Router();

module.exports = () => {
  router.get('/', (req, res) => {
    res.render('pages/index', { greeting: 'Muziki', artists: [] });
  });

  router.use('/artists', artistsRoute());
  router.use('/tracks', tracksRoute());

  return router;
};
