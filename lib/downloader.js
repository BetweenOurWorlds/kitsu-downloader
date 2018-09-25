const Kitsu = require('kitsu');
const https = require('https');
const Q = require('q');
const request = require('sync-request');
const validator = require('validator');

const kitsu = new Kitsu();

function downloadAnime(limit, offset) {
  let deferred = Q.defer();
  let promises = [];
  let streamsArray = [];
  let episodesArray = [];
  let charactersArray = [];

  kitsu.get('anime',  {
      page: { limit, offset }
    }).then(res => {
      res.data.forEach(anime => {
        anime.otherWebsites = [];
        let animeDeferred = Q.defer();
        promises.push(animeDeferred.promise);
        deleteUnwantedAnimeData(anime);

        let id = anime.id;

        //console.log(`anime id = ${id}`);

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
              //console.error(e.message);
              deferred.reject(e);
            }
          });
        });

	      //parse episodes
        let episodePromise = recursiveEpisodes(`https://kitsu.io/api/edge/anime/${id}/episodes`, anime);

        episodePromise.then(a => {
          //console.log(a.length);
          episodesArray = episodesArray.concat(a);
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
              //console.error(e.message);
              deferred.reject(e);
            }
          });
        });

        //parse characters to other websites
        let characterDeferred = Q.defer();
        let characterURL = `https://kitsu.io/api/edge/anime/${id}?include=characters.character`;

        https.get(characterURL, res => {
          res.setEncoding('utf8');
          let rawData = '';

          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              const parsedData = JSON.parse(rawData);
              parsedData.included.forEach(item => {
                if (item.type === 'characters') {
                  deleteUnwantedCharacterData(item);
                  item.anime_id = anime.id;
                  charactersArray.push(item);
                }
              });

              characterDeferred.resolve();
            } catch (e) {
              //console.error(e.message);
              deferred.reject(e);
            }
          });
        });

        Q.all([mappingDeferred.promise, streamDeferred.promise, episodePromise, characterDeferred.promise]).then(() => {
          animeDeferred.resolve();
        });
      });

      Q.all(promises).then(() => {
        deferred.resolve({
          anime: res,
          streams: streamsArray,
	        episodes: episodesArray,
          seasons: getSeasonsFromEpisodes(episodesArray),
          characters: charactersArray
        });
      });
    }).catch(e => {
      console.error(`retrieving data with offset ${offset} failed.`);
      deferred.reject(e);
  });

  return deferred.promise;
}

function deleteUnwantedAnimeData(anime){
  delete anime.relationships;
  delete anime.attributes.ratingFrequencies;
  delete anime.attributes.userCount;
  delete anime.attributes.favoritesCount;
  delete anime.attributes.popularityRank;
  delete anime.attributes.ratingRank;
  delete anime.attributes.averageRating;
  delete anime.links;
}

function deleteUnwantedCharacterData(character) {
  delete character.relationships;
  delete character.attributes.createdAt;
  delete character.attributes.updatedAt;
  delete character.type;
  delete character.links;
}

function convertMappingToWebsiteURL(m){
  switch (m.attributes.externalSite) {
    case 'myanimelist/anime':
      return `https://myanimelist.net/anime/${m.attributes.externalId}`;

    case 'thetvdb/series':
      return `http://thetvdb.com/?tab=series&id=${m.attributes.externalId}`;

    case 'anidb':
      return `https://anidb.net/perl-bin/animedb.pl?show=anime&aid=${m.attributes.externalId}`;

    case 'animenewsnetwork':
      return `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${m.attributes.externalId}`;

    case 'anilist':
      return `https://anilist.co/${m.attributes.externalId}`;
   
    case 'trakt':
      let text = request('GET', `https://trakt.tv/shows/${m.attributes.externalId}`, {followRedirects: false}).body.toString('utf-8');
      text = text.replace(`<html><body>You are being <a href="`, '').replace(`">redirected</a>.</body></html>`, '');

      if (validator.isURL(text)) {
        return text;
      } else {
        console.error(`creating Trakt URL failed for ID ${m.attributes.externalId}.`);
        return null;
      }

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

function recursiveEpisodes(url, anime) {
  let episodesArray = [];
  const deferred = Q.defer();

  https.get(url, episodes => {
		episodes.setEncoding('utf8');
		let rawData = '';
		episodes.on('data', (chunk) => { rawData += chunk; });
		episodes.on('end', () => {
		  let parsedData;

		  try {
		    parsedData = JSON.parse(rawData);

		    if (parsedData.data) {
          parsedData.data.forEach(e => {
            e.anime_id = anime.id;
            e.anime_slug = anime.attributes.slug;

            delete e.relationships;
            delete e.links;
          });

          //console.log(url + ' before ' + episodesArray.length);
          episodesArray = episodesArray.concat(parsedData.data);
          //console.log(url + ' after ' + episodesArray.length);

          if (parsedData.links.next) {
            recursiveEpisodes(parsedData.links.next, anime).then(a => {
              deferred.resolve(episodesArray.concat(a));
            });
          } else {
            deferred.resolve(episodesArray);
          }
        } else {
		      console.error(`No episodes are available for ${anime.attributes.slug}`);
          deferred.resolve(episodesArray);
        }
		  } catch (e) {
        console.log(anime.attributes.slug);
		    console.error(e.message);
		    deferred.reject(e);
		  }
		});
	});

  return deferred.promise;
}

function getSeasonsFromEpisodes(episodes) {
  const seasons = [];
  const hashes = [];

  episodes.forEach(episode => {
    if (episode.attributes.seasonNumber) {
      const hash = episode.attributes.seasonNumber + ' - ' + episode.anime_id;

      if (hashes.indexOf(hash) === -1) {
        seasons.push(
          {
            seasonNumber: episode.attributes.seasonNumber,
            anime: {
              id: episode.anime_id,
              slug: episode.anime_slug
            }
          }
        );

        hashes.push(hash);
      }
    }
  });

  return seasons;
}

module.exports = downloadAnime;
