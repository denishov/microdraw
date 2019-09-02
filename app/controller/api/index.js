const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

const fs = require('fs');

const TMP_DIR = process.env.TMP_DIR
const storage = TMP_DIR
    ? multer.diskStorage({
        destination: TMP_DIR
    })
    : multer.memoryStorage()

// API routes

router.get('/', function (req, res) {
    console.warn("call to GET api");
    console.warn(req.query);

    const user = (req.user && req.user.username) || 'anonymous';
    const project = (req.query.project) || '';

    // find project users
    req.app.db.queryProject({shortname: project})
    .then((result) => {
        const users = [];
        
        if(typeof result !== 'undefined') {
            users.push(...result.collaborators.list.map((u)=>u.username));
        }
        console.log(`users: [${JSON.stringify(users)}]`);

        // find annotations
        req.app.db.findAnnotations({
            fileID: buildFileID(req.query),
            user: { $in: users },
            project: project
        })
            .then(annotations=>res.status(200).send(annotations))
            .catch(e=>res.status(500).send({err:JSON.stringify(e)}))
    })
    .catch((err) => console.log("ERROR api/index.js", err));
});

function buildFileID({source, slice}) {
    return `${source}&slice=${slice}`;
}

const saveFromGUI = function (req, res) {
    const { Hash, annotation } = req.body;
    const user = (req.user && req.user.username) || 'anonymous';
    const project = (req.body.project) || '';

    req.app.db.updateAnnotation({
        fileID : buildFileID(req.body),
        user,
        project,
        Hash,
        annotation
    })
        .then(() => res.status(200).send())
        .catch((e) => res.status(500).send({err:JSON.stringify(e)}));
};

/**
 * Tests if an object is a valid annotation.
 * @param {object} obj An annotation object to validate.
 * @returns {boolean} True if the object is valid
 */
const jsonIsValid = function (obj) {
    if(typeof obj === 'undefined') {
        return false;
    } else if(obj.constructor !== Array) {
        return false;
    } else if(!obj.every(item => item.annotation && item.annotation.path)) {
        return false;
    }

    return true;
};

/**
 * Loads a json file containing an annotation object.
 * @param {string} annotationPath Path to json file containing an annotation
 * @returns {object} A valid annotation object or nothing.
 */
const loadAnnotationFile = function (annotationPath) {
    const json = JSON.parse(fs.readFileSync(annotationPath).toString());
    if(jsonIsValid(json) === true) {
        return json;
    }
};

const saveFromAPI = async function (req, res) {
    const fileID = buildFileID(req.query);
    const user = req.user && req.user.username;
    const { project, Hash } = req.query;
    const rawString = TMP_DIR
        ? fs.readFileSync(req.files[0].path).toString()
        : req.files[0].buffer.toString();
    const json = JSON.parse(rawString);
    if (typeof user === 'undefined') {
        res.status(401).send({msg: "Invalid user token"});
    } else if (typeof project === 'undefined') {
        res.status(401).send({msg: "Invalid project"});
    } else if(!jsonIsValid(json)) {
        res.status(401).json({msg: "Invalid annotation file"});
    } else {
        const { action } = req.query;
        const annotations = action === 'append'
            ? await req.app.db.findAnnotations({ fileID, user, project })
            : { Regions: [] };

        /**
         * use object destruction to avoid mutation of annotations object
         */
        const { Regions, ...rest } = annotations

        req.app.db.updateAnnotation({
            fileID,
            user,
            project,
            Hash,
            annotation: JSON.stringify({
                ...rest,
                Regions: Regions.concat(json.map(v => v.annotation))
            })
        })
            .then(() => res.status(200).send({msg: "Annotation successfully saved"}))
            .catch((e) => res.status(500).send({err:JSON.stringify(e)}));
    }
};

router.post('/', function (req, res) {
    console.warn("call to POST from GUI");

    if(req.body.action === 'save') {
        saveFromGUI(req, res);
    } else {
        res.status(500).send({err:'actions other than save are no longer supported.'});
    }
});

const filterAuthorizedUserOnly = (req, res, next) => {
    const user = req.user && req.user.username;
    if (typeof user === 'undefined') {
        return res.status(401).send({msg:'Invalid user'});
    } else {
        return next()
    }
}

router.post('/upload', filterAuthorizedUserOnly, multer({ storage }).array('data'), function (req, res) {
    console.warn("call to POST from API");

    const { action } = req.query
    switch(action) {
        case 'save': 
        case 'append':
            saveFromAPI(req, res)
        break;
        default:
            return res.status(500).send({err: `actions other than save and append are no longer supported`})
    }
});

router.use('', (req, res) => {
    return res.redirect('/')
})

module.exports = router;