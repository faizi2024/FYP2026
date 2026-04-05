const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const User = require('../models/user'); 

// --- NEW: AUTH MIDDLEWARE ---
// This checks the "Bearer <token>" header sent by your frontend
const protect = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (token && token.startsWith('Bearer')) {
      token = token.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } else {
      res.status(401).json({ error: "Not authorized, no token" });
    }
  } catch (error) {
    res.status(401).json({ error: "Not authorized, token failed" });
  }
};

// 1. REGISTER (SIGNUP) ROUTE
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Please provide name, email, and password" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      measurements: { heightCm: 0, weightKg: 0, chestCm: 0, waistCm: 0 } // Initialize empty
    });

    await newUser.save();
    res.status(201).json({ msg: "Registration successful! Please log in." });
  } catch (err) {
    res.status(500).json({ error: "Internal server error during signup" });
  }
});

// 2. LOGIN ROUTE
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        measurements: user.measurements // Send measurements on login!
      } 
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- 3. NEW: UPDATE PROFILE ROUTE ---
// This is what the MeasurementsForm is looking for!
router.patch("/profile", protect, async (req, res) => {
  try {
    const { measurements } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { measurements: measurements } },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    console.log(`✅ Profile Updated for: ${user.email}`);
    res.json(user);
  } catch (err) {
    console.error("🔥 Profile Update Error:", err.message);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

module.exports = router;