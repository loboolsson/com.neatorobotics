'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const FormData = require('form-data');
const NeatoRobot = require('./NeatoRobot');

class NeatoApi {

  constructor() {
    this._clientId = Homey.env.NEATO_CLIENT_ID;
    this._clientSecret = Homey.env.NEATO_SECRET;
    this._scope = Homey.env.NEATO_SCOPES;
    this._apiBaseUrl = 'https://beehive.neatocloud.com';
    this._oAuthBaseUrl = 'https://apps.neatorobotics.com/oauth2';
    this._oAuthRedirectUrl = 'https://callback.athom.com/oauth2/callback/';
    this._oAuth2AuthUrl = `${this._oAuthBaseUrl}/authorize?response_type=code&client_id=${this._clientId}&scope=${this._scope}&redirect_uri=${this._oAuthRedirectUrl}`;
    this._oAuth2TokenUrl = `${this._oAuthBaseUrl}/token`;
    this._token = null;
    this._refreshToken = null;
  }

  async _doAuthenticatedRequest(url, requestMethod, requestBody) {
    let time = new Date();
    let requestHeaders = {
      Accept: 'application/json',
      Authorization: `Bearer ${this._token}`,
      'X-Date': time.toUTCString(),
      'Content-type': 'application/json'
    };

    if (requestBody) return await fetch(url, {method: requestMethod, headers: requestHeaders, body: requestBody});
    return await fetch(url, {method: requestMethod, headers: requestHeaders});
  }

  /*
  ========================================================================================
  Authorization code
  ========================================================================================
  */
  getOAuth2AuthorizationUrl() {
    return this._oAuth2AuthUrl;
  }

  getToken () {
    return this._token;
  }

  setToken(token) {
    this._token = token;
  }

  getRefreshToken () {
    return this._refreshToken;
  }

  setRefreshToken(refreshToken) {
    this._refreshToken = refreshToken;
  }

  async exchangeCode(code) {
    let formData = new FormData();
    formData.append('client_id', Homey.env.NEATO_CLIENT_ID);
    formData.append('client_secret', Homey.env.NEATO_SECRET);
    formData.append('redirect_uri', 'https://callback.athom.com/oauth2/callback/');
    formData.append('grant_type', 'authorization_code');
    formData.append('code', code);

    let response = await fetch(this._oAuth2TokenUrl, {method: 'POST', body: formData});

    if (!response.ok) throw new Error(Homey.__('failed_to_get_token'));
    return await response.json();
  }

  async refreshAccessToken(refreshToken) {
    let formData = new FormData();
    formData.append('client_id', Homey.env.NEATO_CLIENT_ID);
    formData.append('client_secret', Homey.env.NEATO_SECRET);
    formData.append('grant_type', 'refresh_token');
    formData.append('refresh_token', refreshToken);

    let response = await fetch(this._oAuth2TokenUrl, {method: 'POST', body: formData});

    if (!response.ok) throw new Error(Homey.__('failed_to_get_token'));
    return await response.json();
  }

  /*
  ========================================================================================
  API code
  ========================================================================================
  */

  async getRobots() {
    let robots = [];
    let response = await this._doAuthenticatedRequest(`${this._apiBaseUrl}/users/me/robots`, 'GET', null);

    if (!response.ok) {
      console.log('Getting robots response status:', response.status);
      console.log('Getting robots response text:', response.statusText);
      throw new Error(Homey.__('error_getting_robots'));
    }
    let responseObject = await response.json();

    for(let i = 0; i < responseObject.length; i++) {
      let robot = responseObject[i];
      robots.push(new NeatoRobot(robot));
    }

    return robots;
  }

  async getOneRobot(serial) {
    let response = await this._doAuthenticatedRequest(`${this._apiBaseUrl}/users/me/robots`, 'GET', null);

    if (!response.ok) {
      console.log('Getting single robot response status:', response.status);
      console.log('Getting single robot response text:', response.statusText);
      throw new Error(Homey.__('error_getting_single_robot'));
    }
    let responseObject = await response.json();

    for (let i = 0; i < responseObject.length; i++) {
      let robot = responseObject[i];

      if (robot.serial === serial) {
        return new NeatoRobot(robot);
      }
    }
  }
}

module.exports = NeatoApi;
