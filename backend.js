// ========================================
// BACKEND SERVER IMPLEMENTATION (Node.js/Express)
// ========================================

// 1. Install dependencies:
// npm install @sendgrid/mail express cors dotenv express-rate-limit passport passport-google-oauth20 express-session mongoose

// ========================================

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// CORS setup (very important!)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(session({ secret: 'your_secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Set SendGrid API key from environment variable
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Rate limiting (optional)
const emailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many email requests, please try again later.'
});
app.use('/api/send-email', emailRateLimit);

// Unified endpoint to send emails (supports custom fromEmail/fromName)
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, text, html, fromEmail, fromName } = req.body;

    // Validate required fields
    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, and text/html' 
      });
    }

    // Email configuration
    const msg = {
      to: to,
      from: {
        email: fromEmail || process.env.FROM_EMAIL || 'anya.sunglassretailer@gmail.com',
        name: fromName || process.env.FROM_NAME || 'Anya Ganger'
      },
      subject: subject,
      text: text,
      html: html || text,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    // Send email
    const response = await sgMail.send(msg);

    // Log success
    console.log('Email sent successfully:', {
      to: to,
      subject: subject,
      messageId: response[0].headers['x-message-id']
    });

    res.status(200).json({
      success: true,
      messageId: response[0].headers['x-message-id'],
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('SendGrid error:', error);

    if (error.response) {
      res.status(error.code || 500).json({
        error: 'SendGrid API error',
        details: error.response.body.errors || error.message
      });
    } else {
      res.status(500).json({
        error: 'Server error',
        details: error.message
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.json({
    status: dbState === 1 ? 'OK' : 'Not connected',
    dbState
  });
});

// ========================================
// SENDGRID WEBHOOK HANDLER (Optional - for tracking)
// ========================================

// Endpoint to handle SendGrid event webhooks
app.post('/api/sendgrid-webhook', express.raw({type: 'application/json'}), (req, res) => {
  const events = JSON.parse(req.body.toString());
  
  events.forEach(event => {
    console.log('SendGrid Event:', {
      email: event.email,
      event: event.event,
      timestamp: event.timestamp,
      messageId: event.sg_message_id
    });
    
    // Update your database based on the event
    switch(event.event) {
      case 'delivered':
        // Update email status to delivered
        break;
      case 'open':
        // Increment open count
        break;
      case 'click':
        // Track click events
        break;
      case 'bounce':
      case 'dropped':
        // Handle failed delivery
        break;
    }
  });
  
  res.status(200).send('OK');
});

// ========================================
// TESTING WITH CURL
// ========================================

/*
Test your backend API with curl:

curl -X POST http://localhost:3001/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "samanthamdurrant@gmail.com",
    "subject": "Test Email",
    "text": "This is a test email from the sunglasses dashboard!"
  }'
*/

// ========================================
// ERROR HANDLING AND VALIDATION
// ========================================

// Enhanced error handling function
const handleSendGridError = (error) => {
  if (error.response) {
    const { errors } = error.response.body;
    
    // Common SendGrid error handling
    if (errors) {
      errors.forEach(err => {
        switch(err.field) {
          case 'from.email':
            console.error('Invalid sender email - make sure it\'s verified in SendGrid');
            break;
          case 'personalizations.0.to':
            console.error('Invalid recipient email address');
            break;
          default:
            console.error('SendGrid error:', err.message);
        }
      });
    }
  }
  
  return error.message;
};

// Email validation function
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ========================================
// ENVIRONMENT VARIABLES (.env file)
// ========================================

// Move the following lines to a separate .env file in your project root:
// SENDGRID_API_KEY=your_sendgrid_api_key
// FROM_EMAIL=ganger@wharton.upenn.edu
// FROM_NAME=Anya Ganger
// PORT=3001

// ========================================
// GOOGLE OAUTH2 AUTHENTICATION
// ========================================

// Comment out all Google OAuth/passport code below:

/*
const allowedUsers = [
    "samanthamdurrant@gmail.com",
    "anya.sunglassretailer@gmail.com",
    "ganger@wharton.upenn.edu",
    "anya@example.com",
    "admin@example.com"
];

passport.use(new GoogleStrategy({
    clientID: '825514403976-i36n5fbhof9csgm11cet3oa1h1nfa3dq.apps.googleusercontent.com',
    clientSecret: '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',
    callbackURL: 'https://ganger.com/anya/outreach/'
}, (accessToken, refreshToken, profile, done) => {
    if (allowedUsers.includes(profile.emails[0].value.toLowerCase())) {
        return done(null, profile);
    } else {
        return done(null, false, { message: 'Not authorized' });
    }
}));

passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect(`http://localhost:3000/oauth-success?email=${encodeURIComponent(req.user.emails[0].value)}`);
    }
);

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ email: req.user.emails[0].value });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});
*/

// 1. --- MONGOOSE SETUP ---
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 2. --- SCHEMA & MODEL ---
const ContactSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  additionalInfo: String,
}, { _id: true });

const OrgSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  category: { type: String, required: true },
  contacts: [ContactSchema],
});

const Org = mongoose.model('Org', OrgSchema);

// 3. --- API ENDPOINTS ---

// GET all orgs/brands/people and their contacts
app.get('/api/master-list', async (req, res) => {
  const orgs = await Org.find({});
  res.json(orgs);
});

// POST add a new org/brand/person (with category)
app.post('/api/master-list', async (req, res) => {
  const { name, category } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category required' });
  try {
    const org = new Org({ name, category, contacts: [] });
    await org.save();
    res.status(201).json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST add a contact to an org/brand/person
app.post('/api/master-list/:orgId/contact', async (req, res) => {
  const { orgId } = req.params;
  const { name, email, phone, additionalInfo } = req.body;
  if (!name || (!email && !phone)) return res.status(400).json({ error: 'Contact name and at least email or phone required' });
  try {
    const org = await Org.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Prevent duplicate email/phone
    const duplicate = org.contacts.find(
      c => (email && c.email === email) || (phone && c.phone === phone)
    );
    if (duplicate) return res.status(409).json({ error: 'Duplicate contact (email or phone)' });

    org.contacts.push({ name, email, phone, additionalInfo });
    await org.save();
    res.status(201).json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT edit a contact
app.put('/api/master-list/:orgId/contact/:contactId', async (req, res) => {
  const { orgId, contactId } = req.params;
  const { name, email, phone, additionalInfo } = req.body;
  try {
    const org = await Org.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    const contact = org.contacts.id(contactId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    // Prevent duplicate email/phone (excluding self)
    const duplicate = org.contacts.find(
      c => c.id !== contactId && ((email && c.email === email) || (phone && c.phone === phone))
    );
    if (duplicate) return res.status(409).json({ error: 'Duplicate contact (email or phone)' });

    contact.name = name;
    contact.email = email;
    contact.phone = phone;
    contact.additionalInfo = additionalInfo;
    await org.save();
    res.json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a contact
app.delete('/api/master-list/:orgId/contact/:contactId', async (req, res) => {
  const { orgId, contactId } = req.params;
  try {
    const org = await Org.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    org.contacts.id(contactId).remove();
    await org.save();
    res.json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
