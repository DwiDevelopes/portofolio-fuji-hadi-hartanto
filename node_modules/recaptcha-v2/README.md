# node-recaptcha

node-recaptcha renders and verifies [reCAPTCHA](http://www.google.com/recaptcha) captchas.

**NOTE**: This release uses the latest v2 [reCAPTCHA] (http://www.google.com/recaptcha)

## Installation

Via git:

    $ git clone git://github.com/mrpetef10/node-recaptcha-v2.git ~/.node_libraries/node-recaptcha-v2

Via npm:

    $ npm install recaptcha-v2

## Setup

Before you can use this module, you must visit [reCAPTCHA] (http://www.google.com/recaptcha)
to request a public and private API key for your domain.

## Example Using [Express](http://www.expressjs.com)

app.js:

    var express  = require('express'),
        Recaptcha = require('recaptcha').Recaptcha;

    var PUBLIC_KEY  = 'YOUR_PUBLIC_KEY',
        PRIVATE_KEY = 'YOUR_PRIVATE_KEY';

    var app = express.createServer();

    app.configure(function() {
        app.use(express.bodyParser());
    });

    app.get('/', function(req, res) {
        var recaptcha = new Recaptcha(PUBLIC_KEY, PRIVATE_KEY);

        res.render('form.jade', {
            layout: false,
            locals: {
                recaptcha_form: recaptcha.toHTML()
            }
        });
    });

    app.post('/', function(req, res) {
        var data = {
			remoteip:  req.connection.remoteAddress,
			response:  req.param("g-recaptcha-response"),
			secret: PRIVATE_KEY
        };
        var recaptcha = new Recaptcha(PUBLIC_KEY, PRIVATE_KEY, data);

        recaptcha.verify(function(success, error_code) {
            if (success) {
                res.send('Recaptcha response valid.');
            }
            else {
                // Redisplay the form.
                res.render('form.jade', {
                    layout: false,
                    locals: {
                        recaptcha_form: recaptcha.toHTML()
                    }
                });
            }
        });
    });

    app.listen(3000);

views/form.jade:

    form(method='POST', action='.')
      != recaptcha_form

      input(type='submit', value='Check Recaptcha')

Make sure [express](http://www.expressjs.com) and [jade](http://jade-lang.com)
are installed, then:

    $ node app.js
