/*!
 * recaptcha-v2
 * Copyright(c) 2015 Pete Mardell (https://github.com/mrpetef10)
 * Based on Michael Hampton's node-recaptcha (https://www.npmjs.com/package/recaptcha) (https://www.npmjs.com/~mirhampt)
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var https = require('https'),
querystring = require('querystring');

/**
 * Constants.
 */

var API_HOST      = 'www.google.com',
    API_END_POINT = '/recaptcha/api/siteverify';

/**
 * Initialize Recaptcha with given `public_key`, `private_key` and optionally
 * `data`.
 *
 * The `data` argument should have the following keys and values:
 *
 *   remoteip:  Optional. The user's IP address.
 *   response: Required. The user response token provided by the reCAPTCHA to the user and provided to your site on.
 *   secret:  Required. The shared key between your site and ReCAPTCHA.
 *
 * @param {String} public_key Your Recaptcha public key.
 * @param {String} private_key Your Recaptcha private key.
 * @param {Object} data The Recaptcha data to be verified.  See above for
 *                      format.  (optional)
 * @param {Boolean} secure Flag for using https connections to load client-facing things. (optional)
 * @api public
 */

var Recaptcha = exports.Recaptcha = function Recaptcha(public_key, private_key, data, secure) {
    this.public_key = public_key;
    this.private_key = private_key;
    if (typeof(data) == 'boolean'){
        this.data = undefined;
        this.is_secure = data;
    }
    else {
        this.data = data;
        this.is_secure = secure;
    }

    return this;
}

/**
 * Render the Recaptcha fields as HTML.
 *
 * If there was an error during `verify` and the selected Recaptcha theme
 * supports it, it will be displayed.
 *
 * @api public
 */

Recaptcha.prototype.toHTML = function() {
    return '<div class="g-recaptcha" data-sitekey="' + this.public_key + '"></div>';
};

/**
 * Verify the Recaptcha response.
 *
 * Example usage:
 *
 *     var recaptcha = new Recaptcha('PUBLIC_KEY', 'PRIVATE_KEY', data);
 *     recaptcha.verify(function(success, error_code) {
 *         if (success) {
 *             // data was valid.  Continue onward.
 *         }
 *         else {
 *             // data was invalid, redisplay the form using
 *             // recaptcha.toHTML().
 *         }
 *     });
 *
 * @param {Function} callback
 * @api public
 */

Recaptcha.prototype.verify = function(callback) {
    var self = this;

    // See if we can declare this invalid without even contacting Recaptcha.
    if(typeof(this.data) === 'undefined') {
        this.error_code = 'invalid-input-response';
        return callback(false, this.error_code);
    }
    if(!('response' in this.data &&
		  'secret' in this.data))
    {
        this.error_code = 'invalid-input-response';
        return callback(false, this.error_code);
    }
    if(this.data.response === '') {
        this.error_code = 'missing-input-response';
        return callback(false, this.error_code);
    }
	if(this.data.secret === '') {
        this.error_code = 'missing-input-secret';
        return callback(false, this.error_code);
    }
	
    var data_qs = querystring.stringify(this.data);

    var req_options = {
        host: API_HOST,
        path: API_END_POINT,
        port: 443,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data_qs.length
        }
    };

    var request = https.request(req_options, function(response) {
        var body = '';

        response.on('error', function(err) {
            callback(false, err);
        });

        response.on('data', function(chunk) {
            body += chunk;
        });

        response.on('end', function() {
			body = JSON.parse(body);
            return callback(body['success'], body['error-codes']);
        });
    });
    request.write(data_qs, 'utf8');
    request.end();
};
