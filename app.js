const express = require('express'),
    axios = require('axios'),
    qs = require('qs'),
    expressSession = require('express-session');

const app = express();

app.set('view engine', 'ejs')   // set EJS template engine
require('dotenv').config();     // loading environment variables

// to persist user data - in memory
const sessionMiddleware = expressSession({
    name: "sessionId",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 3600000 * 24 * 7,   //7days
        sameSite: "lax",
        // secure: true,   // set only when using https
        httpOnly: true
    }, 
});

app.use(sessionMiddleware);

app.get('/', (req, res) => {
    res.render('index');
});

// accessible after successful login
app.get('/secret', (req, res) => {
    recData = req.session.data;
    if(!recData) {
        res.redirect('/');
    } else {
        res.render('secret', {
            id: recData.id,
            firstName: recData.firstName.localized.en_US,
            lastName: recData.lastName.localized.en_US,
            profileImageURL: recData.profilePicture["displayImage~"].elements.slice(-1)[0].identifiers[0].identifier
        });
    }
});

// redirect to linkedin OAuth portal to request an authorization code
app.get('/auth/linkedin', (req, res) => {
    const auth_url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&state=${process.env.STATE_SECRET}&scope=${process.env.SCOPE}`

    res.redirect(auth_url);
});

app.get('/auth/linkedin/callback', (req, res) => {
    const receivedCode = req.query.code;
    const receivedState = req.query.state;  // received state secret Used to prevent CSRF (Cross-site request forgery)
    const data = { 
        grant_type: 'authorization_code',
        code: receivedCode,
        redirect_uri: process.env.REDIRECT_URI,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET
    }

    // Exchange Authorization Code for an Access Token
    axios({
        method: 'post',
        url: 'https://www.linkedin.com/oauth/v2/accessToken',
        data: qs.stringify(data),
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
    }).then(function (response) {

        // Use access_token to get userdata 
        axios({
            method: 'get',
            url: 'https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~digitalmediaAsset:playableStreams))',
            headers: { 'Authorization': 'Bearer ' + response.data.access_token }
        }).then(function (resp) {
            const recData = resp.data;

            if(!recData) {
                res.redirect('/');
            }

            // save received data to session and redirect
            req.session.data = recData;
            res.redirect('/secret');
        })
        .catch(function (err) {
            console.log(err)
            res.send('ERROR! :(');
        });
    })
    .catch(function (error) {
        console.log(error)
        res.send('ERROR! :(');
    });
});

app.get('/logout', (req, res) => {
    req.session.data = null;
    res.redirect('/');
});

const hostname = process.env.HOSTNAME;
const port = process.env.PORT;

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});