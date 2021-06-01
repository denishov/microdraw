/* eslint-disable radix */
/* eslint-disable no-plusplus */
// const async = require('async');
// const dateFormat = require('dateformat');
// const checkAccess = require('../checkAccess/checkAccess.js');
// const dataSlices = require('../dataSlices/dataSlices.js');

const validator = function (req, res, next) {
  next();
};

const project = function (req, res) {
  const login = (req.user) ?
    ('<a href=\'/user/' + req.user.username + '\'>' + req.user.username + '</a> (<a href=\'/logout\'>Log Out</a>)') :
    ('<a href=\'/auth/github\'>Log in with GitHub</a>');
  const requestedProject = req.params.projectName;

  // Store return path in case of login
  req.session.returnTo = req.originalUrl;

  req.appConfig.db.queryProject({shortname: requestedProject})
    .then((json) => {
      if (json) {
        const context = {
          projectShortname: json.shortname,
          projectInfo: JSON.stringify(json),
          login
        };
        res.render('project', context);
      } else {
        res.status(404).send('Project Not Found');
      }
    })
    .catch((err) => {
      console.log('ERROR:', err);
      res.status(400).send('Error');
    });
};

/**
 * @desc Render the settings page GUI
 * @param {Object} req Req object from express
 * @param {Object} res Res object from express
 * @returns {void}
 */
var settings = function(req, res) {
  console.log("Settings");
  var login = (req.isAuthenticated()) ?
    ("<a href='/user/" + req.user.username + "'>" + req.user.username + "</a> (<a href='/logout'>Log Out</a>)")
    : ("<a href='/auth/github'>Log in with GitHub</a>");
  const requestedProject = req.params.projectName;

  var loggedUser = "anyone";
  if(req.isAuthenticated()) {
    loggedUser = req.user.username;
  } else
  if(req.isTokenAuthenticated) {
    loggedUser = req.tokenUsername;
  }

  // store return path in case of login
  req.session.returnTo = req.originalUrl;

  req.appConfig.db.queryProject({shortname: requestedProject})
    .then(function(json) {
      if(typeof json === 'undefined') {
        json = {
          name: "",
          shortname: requestedProject,
          url: "",
          created: (new Date()).toJSON(),
          owner: loggedUser,
          collaborators: {
            list: [
              {
                username: 'anyone',
                access: {
                  collaborators: 'view',
                  annotations: 'edit',
                  files: 'view'
                }
              }
            ]
          },
          files: {
            list: []
          },
          annotations: {
            list: []
          }
        };
      }

      // @todo empty the files.list because it will be filled progressively from the client
      // json.files.list = [];

      // find username and name for each of the collaborators in the project
      const arr1 = [];
      for(let j=0; j<json.collaborators.list.length; j++) {
        arr1.push(req.appConfig.db.queryUser({username: json.collaborators.list[j].username}));
      }

      Promise.all(arr1)
        .then(function(obj) {
          for(let j=0; j<obj.length; j++) {
            if(obj[j]) { // name found
              json.collaborators.list[j].name=obj[j].name;
            } else { // name not found: set to empty
              json.collaborators.list[j].name = "";
            }
          }
          var context = {
            projectShortname: json.shortname,
            owner: json.owner,
            projectInfo: JSON.stringify(json),
            login: login
          };
          res.render('projectSettings', context);
        })
        .catch((e) => console.log("Error:", e));
    })
    .catch((e) => console.log("Error:", e));
};

/**
 * @function projectNew
 * @desc Render the page with the GUI for entering a new project
 * @param {Object} req Req object from express
 * @param {Object} res Res object from express
 * @returns {void}
 */
const projectNew = function (req, res) {
  console.log("New Project");

  const login = (req.user) ?
    ('<a href=\'/user/' + req.user.username + '\'>' + req.user.username + '</a> (<a href=\'/logout\'>Log Out</a>)') :
    ('<a href=\'/auth/github\'>Log in with GitHub</a>');
  let loggedUser = "anyone";
  if(req.isAuthenticated()) {
    loggedUser = req.user.username;
  } else
  if(req.isTokenAuthenticated) {
    loggedUser = req.tokenUsername;
  }

  // Store return path in case of login
  req.session.returnTo = req.originalUrl;

  if(loggedUser === "anyone" ) {
    res.render('askForLogin', {
      title: "MicroDraw: New Project",
      functionality: "create a new project",
      login: login
    });
  } else {
    res.render('projectNew', {
      title: "MicroDraw: New Project",
      login: login
    });
  }
};

const apiProject = function (req, res) {
  console.log("GET project", req.params);
  req.appConfig.db.queryProject({shortname: req.params.projectName, backup: {$exists: false}})
    .then((json) => {
      if (json) {
        if (req.query.var) {
          let i;
          const arr = req.query.var.split('/');
          for (i in arr) {
            if({}.hasOwnProperty.call(arr, i)) {
              json = json[arr[i]];
            }
          }
        }
        res.send(json);
      } else {
        res.send();
      }
    });
};

const apiProjectAll = function (req, res) {
  console.log('api_projectAll');
  if (!req.query.page) {
    res.json({error: 'The \'pages\' parameter has to be specified'});

    return;
  }

  const page = parseInt(req.query.page);
  const nItemsPerPage = 20;

  req.appConfig.db.queryAllProjects({backup: {$exists: false}}, {skip: page * nItemsPerPage, limit: nItemsPerPage, fields: {_id: 0}})
    .then((array) => {
      res.send(array.map((o) => o.shortname ));
    });
};

/**
 * @function apiProjectFiles
 */

/**
 * @todo Check access rights for this route
 */

const apiProjectFiles = function (req, res) {
  const {projectName} = req.params;
  const start = parseInt(req.query.start);
  const length = parseInt(req.query.length);

  console.log('projectName:', projectName, 'start:', start, 'length:', length);
  res.send({});
};

const postProject = function (req, res) {
  // const {projectName} = req.params;
  // const {username} = req.user;
  console.log("POST project", req.body);
  const projectInfo = JSON.parse(req.body.data);

  req.appConfig.db.upsertProject(projectInfo)
    .then((o) => { console.log('postProject', o); res.send({success: true, response: o}); })
    .catch((e) => res
      .send(e)
      .status(403)
      .end());
};

const deleteProject = function (req, res) {
  console.log("DELETE Project");

  let loggedUser = "anyone";
  if(req.isAuthenticated()) {
    loggedUser = req.user.username;
  } else
  if(req.isTokenAuthenticated) {
    loggedUser = req.tokenUsername;
  }

  // Store return path in case of login
  req.session.returnTo = req.originalUrl;

  if(loggedUser === "anyone" ) {
    res.send({message: "Log in required"})
      .status(403)
      .end();
  } else {
    const {projectName} = req.params;

    req.appConfig.db.deleteProject({shortname: projectName})
      .then((o) => {
        console.log('DELETE Project', o);
        res.send({success: true, response: o});
      })
      .catch((e) => res
        .send(e)
        .status(403)
        .end());
  }
};

module.exports = {
  validator,
  apiProject,
  apiProjectAll,
  apiProjectFiles,
  project,
  projectNew,
  settings,
  postProject,
  deleteProject
};
