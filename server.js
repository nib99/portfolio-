const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const basicAuth = require('express-basic-auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_IPS = [process.env.ALLOWED_IP || 'YOUR_LOCAL_IP'];

// Load projects from JSON
const projectsFilePath = path.join(__dirname, 'projects.json');
let projectsData = JSON.parse(fs.readFileSync(projectsFilePath, 'utf-8'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));

// IP Whitelisting Middleware
const ipWhitelist = (req, res, next) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (ALLOWED_IPS.includes(clientIp) || clientIp.includes('::1') || clientIp.includes('127.0.0.1')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: IP not whitelisted' });
  }
};

// Basic Auth Middleware
const adminAuth = basicAuth({
  users: { [process.env.ADMIN_USER]: process.env.ADMIN_PASS },
  challenge: true,
  unauthorizedResponse: 'Unauthorized: Please provide valid credentials',
});

// API to get projects
app.get('/api/projects', (req, res) => {
  res.json(projectsData);
});

// Admin route
app.get('/admin', /* ipWhitelist, */ adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// API to add a project
app.post('/api/projects/add', /* ipWhitelist, */ adminAuth, (req, res) => {
  const { title, description, image, github } = req.body;
  if (!title || !description || !image || !github) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  const newProject = {
    id: (projectsData.projects.length + 1).toString(),
    title,
    description,
    image,
    github,
  };
  projectsData.projects.push(newProject);
  try {
    fs.writeFileSync(projectsFilePath, JSON.stringify(projectsData, null, 2));
    res.json({ message: 'Project added successfully' });
  } catch (error) {
    console.error('Error writing to projects.json:', error);
    res.status(500).json({ message: 'Failed to add project' });
  }
});

// API to update a project
app.put('/api/projects/update/:id', /* ipWhitelist, */ adminAuth, (req, res) => {
  const { id } = req.params;
  const { title, description, image, github } = req.body;
  if (!title || !description || !image || !github) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  const projectIndex = projectsData.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ message: 'Project not found' });
  }
  projectsData.projects[projectIndex] = { id, title, description, image, github };
  try {
    fs.writeFileSync(projectsFilePath, JSON.stringify(projectsData, null, 2));
    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    console.error('Error writing to projects.json:', error);
    res.status(500).json({ message: 'Failed to update project' });
  }
});

// API to delete a project
app.delete('/api/projects/delete/:id', /* ipWhitelist, */ adminAuth, (req, res) => {
  const { id } = req.params;
  const projectIndex = projectsData.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ message: 'Project not found' });
  }
  projectsData.projects.splice(projectIndex, 1);
  try {
    fs.writeFileSync(projectsFilePath, JSON.stringify(projectsData, null, 2));
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error writing to projects.json:', error);
    res.status(500).json({ message: 'Failed to delete project' });
  }
});

// Newsletter subscription route
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  try {
    await sendEmail({
      subject: 'New Newsletter Subscription',
      text: `A new user subscribed: ${email}`,
      html: `<p>A new user subscribed: <strong>${email}</strong></p>`,
    });
    res.json({ message: 'Thank you for subscribing!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to subscribe. Please try again.' });
  }
});

// Contact form route
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    await sendEmail({
      subject: 'New Contact Form Submission',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong> ${message}</p>`,
    });
    res.json({ message: 'Message sent! I’ll get back to you soon.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to send message. Please try again.' });
  }
});

// Function to send email using Nodemailer
async function sendEmail({ subject, text, html }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'ahmadnibraas@gmail.com',
    subject,
    text,
    html,
  };
  return transporter.sendMail(mailOptions);
}

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
