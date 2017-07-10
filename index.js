const Kitsu = require('kitsu');
const https = require('https');
const Q = require('q');

const kitsu = new Kitsu();

downloadAnime(20, 0).then(a => {
  delete a.links;
  console.log(a);
});

function downloadAnime(limit, offset) {
  let deferred = Q.defer();
  let promises = [];

  kitsu.get('anime',  {
      page: { limit: 20, offset: 0 }
    }).then(res => {
      res.data.forEach(anime => {
        let animeDeferred = Q.defer();
        promises.push(animeDeferred.promise);
        deleteUnwantedData(anime);

        let id = anime.id;

        //parse streaming links
        let streamDeferred = Q.defer();
        let streamingLinksURL = `https://kitsu.io/api/edge/anime/${id}/streaming-links`;
        https.get(streamingLinksURL, streams => {
          streams.setEncoding('utf8');
          let rawData = '';
          streams.on('data', (chunk) => { rawData += chunk; });
          streams.on('end', () => {
            try {
              const parsedData = JSON.parse(rawData);
              anime.streams = [];
              parsedData.data.forEach(s => {
                anime.streams.push(s.attributes.url);
              });

              streamDeferred.resolve();
            } catch (e) {
              console.error(e.message);
            }
          });
        });

        //parse mappings to other websites
        let mappingDeferred = Q.defer();
        let mappingsURL = `https://kitsu.io/api/edge/anime/${id}/mappings`;
        https.get(mappingsURL, mappings => {
          mappings.setEncoding('utf8');
          let rawData = '';
          mappings.on('data', (chunk) => { rawData += chunk; });
          mappings.on('end', () => {
            try {
              const parsedData = JSON.parse(rawData);
              anime.otherWebsites = [];
              parsedData.data.forEach(m => {
                let website = convertMappingToWebsiteURL(m);

                if (website) {
                  anime.otherWebsites.push(website);
                }
              });

              mappingDeferred.resolve();
            } catch (e) {
              console.error(e.message);
            }
          });
        });

        Q.all([mappingDeferred.promise, streamDeferred.promise]).then(() => {
          animeDeferred.resolve();
        });
      });

      Q.all(promises).then(() => {
        deferred.resolve(res);
      });;
    });

  return deferred.promise;
}

function deleteUnwantedData(anime){
  delete anime.relationships;
  delete anime.attributes.ratingFrequencies;
  delete anime.attributes.userCount;
  delete anime.attributes.favoritesCount;
  delete anime.attributes.popularityRank;
  delete anime.attributes.ratingRank;
  delete anime.attributes.averageRating;
  delete anime.links;
}

function convertMappingToWebsiteURL(m){
  switch (m.attributes.externalSite) {
    case 'myanimelist/anime':
      return `https://myanimelist.net/anime/${m.attributes.externalId}`;

    case 'thetvdb/series':
      return `http://thetvdb.com/?tab=series&id=${m.attributes.externalId}`;

    case 'anidb':
      return `https://anidb.net/perl-bin/animedb.pl?show=anime&aid=${m.attributes.externalId}`;

    default:
      return null;
  }
}
