'use strict';

const Homey = require('homey');
const axios = require('axios').default;
const NodeBotvacClient = require('node-botvac/lib/client');

let AccessToken;

class BotVacDriver extends Homey.Driver {

  robots = [];
  _clientId = Homey.env.NEATO_CLIENT_ID;
  _clientSecret = Homey.env.NEATO_SECRET;
  _scope = Homey.env.NEATO_SCOPES;
  _oAuthBaseUrl = 'https://apps.neatorobotics.com/oauth2';
  _oAuthRedirectUrl = 'https://callback.athom.com/oauth2/callback/';
  _oAuth2AuthUrl = `${this._oAuthBaseUrl}/authorize?response_type=code&client_id=${this._clientId}&scope=${this._scope}&redirect_uri=${this._oAuthRedirectUrl}`;
  _oAuth2TokenUrl = `${this._oAuthBaseUrl}/token`;

  async getOauthToken(code) {
    try {
      const response = await axios
        .post(this._oAuth2TokenUrl, {
          client_id: this._clientId,
          client_secret: this._clientSecret,
          redirect_uri: this._oAuthRedirectUrl,
          grant_type: 'authorization_code',
          code,
        });

      return response.data;
    } catch (error) {
      // Handle Error Here
      console.error(error);
      throw new Error(error);
    }
  }

  async getAllRobots(accessToken) {
    const botvacClient = new NodeBotvacClient(accessToken, 'OAuth');
    const robotPromise = new Promise((resolve, reject) => {
      botvacClient.getRobots((error, robots) => {
        if (error) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject(`Error getting robots: ${error}`);
        } else if (!robots) {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject('0 robots returned');
        } else {
          resolve(robots);
        }
      });
    });
    return robotPromise;
  }

  async listDevices() {
    if (!AccessToken) {
      throw new Error('Cannot list Neato devices!');
    }

    try {
      // Check if we can get the list of devices. If not throw error
      const robots = await this.getAllRobots(AccessToken);
      const devices = robots.map((robot) => {
        return {
          name: robot.name,
          data: {
            id: robot._serial,
          },
          store: {
            secret: robot._secret,
          },
        };
      });
      if (!devices) {
        return [];
      }
      return devices;
    } catch (error) {
      throw new Error(error);
    }
  }

  async onPair(session) {
    const myOAuth2Callback = await this.homey.cloud.createOAuth2Callback(this._oAuth2AuthUrl);
    myOAuth2Callback
      .on('url', (url) => {
        // Send the URL to the front-end to open a popup
        session.emit('url', url);
      })
      .on('code', async (code) => {
        // ... swap your code here for an access token
        const tokensObject = await this.getOauthToken(code);
        if (tokensObject && tokensObject.access_token) {
          AccessToken = tokensObject.access_token;
        } else {
          throw new Error('Cannot get access token from Neato!');
        }
        // tell the front-end we're done
        session.emit('authorized');
      });

    session.setHandler('list_devices', this.listDevices.bind(this));
  }

}

module.exports = BotVacDriver;
