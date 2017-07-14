const Kitsu = require('kitsu');
const https = require('https');
const Q = require('q');

const kitsu = new Kitsu();

function downloadAnime(limit, offset) {
  let deferred = Q.defer();
  let promises = [];
  let streamsArray = [];

  kitsu.get('anime',  {
      page: { limit, offset }
    }).then(res => {
      res.data.forEach(anime => {
        anime.otherWebsites = [];
        let animeDeferred = Q.defer();
        promises.push(animeDeferred.promise);
        deleteUnwantedData(anime);

        let id = anime.id;

        //parse streaming links
        let streamDeferred = Q.defer();
        let streamingLinksURL = `https://kitsu.io/api/edge/anime/${id}/streaming-links?include=streamer`;
        https.get(streamingLinksURL, streams => {
          streams.setEncoding('utf8');
          let rawData = '';
          streams.on('data', (chunk) => { rawData += chunk; });
          streams.on('end', () => {
            try {
              const parsedData = JSON.parse(rawData);
              parsedData.data.forEach(s => {
                let service = getStreamService(parsedData.included, s.relationships.streamer.data.id);

                if (service && isValidServiceURL(s.attributes.url)) {
                  streamsArray.push({
                    service,
                    url: s.attributes.url,
                    slug: anime.attributes.slug
                  });
                }
                anime.otherWebsites.push(s.attributes.url);
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
        deferred.resolve({
          anime: res,
          streams: streamsArray
        });
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
      console.log(`creating website URL: ${m.attributes.externalSite} was not found. ID is ${m.attributes.externalId}.`);
      return null;
  }
}

function isValidServiceURL(url) {
  return url.indexOf('http://') !== -1 || url.indexOf('https://') !== -1;
}

function getStreamService(data, id) {
  let i = 0;

  while (i < data.length && data[i].id !== id) {
    i ++;
  }

  if (i < data.length) {
    return data[i].attributes.siteName.toLowerCase();
  } else {
    return null;
  }
}

module.exports = downloadAnime;
