const Kitsu = require('kitsu');
const https = require('https');
const Q = require('q');
const request = require('sync-request');
const validator = require('validator');
const logger = require('./logger');

class AnimeDownloader {

  constructor(writer) {
    this.writer = writer;
    this.kitsu = new Kitsu();
  }

  downloadRecursive(currentPage, stopPage) {
    logger.debug(`working on page ${currentPage}`);

    this._download(20, currentPage * 20).then(res => {
      let filenameAnime = `anime-${currentPage}.json`;
      let filenameStreams = `streams-${currentPage}.json`;
      let filenameEpisodes = `episodes-${currentPage}.json`;
      let filenameSeasons = `seasons-${currentPage}.json`;

      const data = [{
        data: res.anime,
        path: filenameAnime
      }, {
        data: res.streams,
        path: filenameStreams
      }, {
        data: res.episodes,
        path: filenameEpisodes
      }, {
        data: res.seasons,
        path: filenameSeasons
      }];

      this.writer.write(data).then(() => {
        if (currentPage !== stopPage) {
          this.downloadRecursive(currentPage + 1, stopPage);
        }
      });
    }).catch(e => {
      logger.error(`error during ${currentPage}. Retrying...`);
      this.downloadRecursive(currentPage, stopPage);
    });
  }

  _download(limit, offset) {
    let deferred = Q.defer();
    let promises = [];
    let streamsArray = [];
    let episodesArray = [];

    this.kitsu.get('anime',  {
      page: { limit, offset }
    }).then(res => {
      res.data.forEach(anime => {
        anime.otherWebsites = [];
        let animeDeferred = Q.defer();
        promises.push(animeDeferred.promise);
        this._deleteUnwantedAnimeData(anime);

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
                let service = this._getStreamService(parsedData.included, s.relationships.streamer.data.id);

                if (service && this._isValidServiceURL(s.attributes.url)) {
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
        let episodePromise = this._recursiveEpisodes(`https://kitsu.io/api/edge/anime/${id}/episodes`, anime);

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
                let website = this._convertMappingToWebsiteURL(m);

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

              if (parsedData.included) {
                anime.characters = [];

                parsedData.included.forEach(item => {
                  if (item.type === 'characters') {
                    anime.characters.push(item.attributes.slug);
                  }
                });
              } else {
                logger.warn(`no characters found for anime with id "${anime.id}"`);
              }

              characterDeferred.resolve();
            } catch (e) {
              //console.error(e.message);
              logger.error(`error during processing of characters`);
              deferred.reject(e);
            }
          });
        });

        //characterDeferred.resolve();

        Q.all([mappingDeferred.promise, streamDeferred.promise, episodePromise, characterDeferred.promise]).then(() => {
          animeDeferred.resolve();
        });
      });

      Q.all(promises).then(() => {
        deferred.resolve({
          anime: res,
          streams: streamsArray,
          episodes: episodesArray,
          seasons: this._getSeasonsFromEpisodes(episodesArray),
        });
      });
    }).catch(e => {
      logger.error(`retrieving data with offset ${offset} failed.`);
      deferred.reject(e);
    });

    return deferred.promise;
  }

  _deleteUnwantedAnimeData(anime){
    delete anime.relationships;
    delete anime.attributes.ratingFrequencies;
    delete anime.attributes.userCount;
    delete anime.attributes.favoritesCount;
    delete anime.attributes.popularityRank;
    delete anime.attributes.ratingRank;
    delete anime.attributes.averageRating;
    delete anime.links;
  }

  _convertMappingToWebsiteURL(m){
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
          logger.debug(`creating Trakt URL failed for ID ${m.attributes.externalId}.`);
          return null;
        }

      default:
        logger.warn(`creating website URL: ${m.attributes.externalSite} was not found. ID is ${m.attributes.externalId}.`);
        return null;
    }
  }

  _isValidServiceURL(url) {
    return url.indexOf('http://') !== -1 || url.indexOf('https://') !== -1;
  }

  _getStreamService(data, id) {
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

  _recursiveEpisodes(url, anime) {
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
              this._recursiveEpisodes(parsedData.links.next, anime).then(a => {
                deferred.resolve(episodesArray.concat(a));
              });
            } else {
              deferred.resolve(episodesArray);
            }
          } else {
            logger.debug(`No episodes are available for ${anime.attributes.slug}`);
            deferred.resolve(episodesArray);
          }
        } catch (e) {
          logger.debug(anime.attributes.slug);
          logger.error(e.message);
          deferred.reject(e);
        }
      });
    });

    return deferred.promise;
  }

  _getSeasonsFromEpisodes(episodes) {
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
}

module.exports = AnimeDownloader;
