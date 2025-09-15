const axios = require('axios');
const logger = require('./logger.js');

class GitHubAPI {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.clientId = process.env.GITHUB_CLIENT_ID;
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code, redirectUri) {
    try {
      const response = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: redirectUri
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.data.error) {
        throw new Error(response.data.error_description || response.data.error);
      }

      return response.data.access_token;
    } catch (error) {
      logger.error('GitHub token exchange failed:', error);
      throw error;
    }
  }

  // Get user information from GitHub
  async getUser(accessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/user`, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('GitHub get user failed:', error);
      throw error;
    }
  }

  // Create a new gist
  async createGist(accessToken, filename, content, description = 'Calendario Digital - Tasks Data') {
    try {
      const response = await axios.post(`${this.baseURL}/gists`, {
        description,
        public: false,
        files: {
          [filename]: {
            content: JSON.stringify(content, null, 2)
          }
        }
      }, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('GitHub create gist failed:', error);
      throw error;
    }
  }

  // Update an existing gist
  async updateGist(accessToken, gistId, filename, content) {
    try {
      const response = await axios.patch(`${this.baseURL}/gists/${gistId}`, {
        files: {
          [filename]: {
            content: JSON.stringify(content, null, 2)
          }
        }
      }, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('GitHub update gist failed:', error);
      throw error;
    }
  }

  // Get a gist by ID
  async getGist(accessToken, gistId) {
    try {
      const response = await axios.get(`${this.baseURL}/gists/${gistId}`, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('GitHub get gist failed:', error);
      throw error;
    }
  }

  // List user's gists
  async listGists(accessToken, perPage = 100) {
    try {
      const response = await axios.get(`${this.baseURL}/gists`, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        params: {
          per_page: perPage
        }
      });

      return response.data;
    } catch (error) {
      logger.error('GitHub list gists failed:', error);
      throw error;
    }
  }

  // Find existing calendar gist
  async findCalendarGist(accessToken, filename = 'calendar-tasks.json') {
    try {
      const gists = await this.listGists(accessToken);
      return gists.find(gist => 
        gist.files && gist.files[filename]
      );
    } catch (error) {
      logger.error('GitHub find calendar gist failed:', error);
      return null;
    }
  }
}

const githubAPI = new GitHubAPI();
module.exports = { GitHubAPI, githubAPI };