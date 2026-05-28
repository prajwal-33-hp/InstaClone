const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const Post = require("../models/Post");
const Story = require("../models/Story");

// ─── Multer Configuration for Profile Pictures ──────────────────────────────
const uploadDir = path.join(__dirname, "../public/images/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${req.session.userId}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (JPEG, PNG, GIF, WebP)"));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Register ──────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, bio } = req.body;

    if (!username || !email || !password)
      return res
        .status(400)
        .json({ error: "Username, email and password are required." });

    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser)
      return res
        .status(409)
        .json({ error: "Username or email already exists." });

    const user = new User({ username, email, password, bio: bio || "" });
    await user.save();

    req.session.userId = user._id;
    req.session.username = user.username;

    res.json({
      message: "Registration successful!",
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email and password are required." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: "Invalid email or password." });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ error: "Invalid email or password." });

    req.session.userId = user._id;
    req.session.username = user.username;

    res.json({
      message: "Login successful!",
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out." }));
});

// ── Current User ──────────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not authenticated." });
  try {
    const user = await User.findById(req.session.userId).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Single User ───────────────────────────────────────────────────────────
router.get("/user/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found." });

    const [postCount, activeStoryCount] = await Promise.all([
      Post.countDocuments({ userId: req.params.userId }),
      Story.countDocuments({ userId: req.params.userId, expiresAt: { $gt: new Date() } }),
    ]);
    const userWithStats = user.toObject();
    userWithStats.postsCount = postCount;
    userWithStats.hasActiveStory = activeStoryCount > 0;

    res.json(userWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update Profile ────────────────────────────────────────────────────────────
router.put("/profile", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not authenticated." });
  try {
    const { bio, username } = req.body;
    const user = await User.findByIdAndUpdate(
      req.session.userId,
      { bio, username },
      { new: true },
    ).select("-password");
    req.session.username = user.username;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Change Password ───────────────────────────────────────────────────────────
router.post("/change-password", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not authenticated." });

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ error: "Current and new passwords are required." });

    if (newPassword.length < 6)
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters." });

    const user = await User.findById(req.session.userId);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch)
      return res.status(401).json({ error: "Current password is incorrect." });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete Account ────────────────────────────────────────────────────────────
router.post("/delete-account", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not authenticated." });

  try {
    const { password } = req.body;

    if (!password)
      return res.status(400).json({ error: "Password is required." });

    const user = await User.findById(req.session.userId);
    const isMatch = await user.comparePassword(password);

    if (!isMatch)
      return res.status(401).json({ error: "Password is incorrect." });

    // Delete user's profile picture
    if (user.profilePic && user.profilePic !== "default-avatar.png") {
      const filePath = path.join(__dirname, "../public", user.profilePic);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete user's posts and associated images
    const userPosts = await Post.find({ userId: req.session.userId });
    for (const post of userPosts) {
      if (post.image) {
        const filePath = path.join(__dirname, "../public", post.image);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    // Delete user and their posts
    await Post.deleteMany({ userId: req.session.userId });
    await User.findByIdAndDelete(req.session.userId);

    // Destroy session
    req.session.destroy();

    res.json({ message: "Account deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Upload Profile Picture ────────────────────────────────────────────────────
router.post(
  "/upload-profile-pic",
  upload.single("profilePicture"),
  async (req, res) => {
    if (!req.session.userId)
      return res.status(401).json({ error: "Not authenticated." });

    try {
      if (!req.file)
        return res.status(400).json({ error: "No file uploaded." });

      const profilePicPath = `/images/uploads/${req.file.filename}`;

      const user = await User.findById(req.session.userId);
      if (user.profilePic && user.profilePic !== "default-avatar.png") {
        const oldFilePath = path.join(__dirname, "../public", user.profilePic);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.session.userId,
        { profilePic: profilePicPath },
        { new: true },
      ).select("-password");

      res.json({
        message: "Profile picture updated successfully!",
        profilePic: profilePicPath,
        user: updatedUser,
      });
    } catch (err) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: err.message });
    }
  },
);

// ── Follow / Unfollow ─────────────────────────────────────────────────────────
router.post("/follow/:targetId", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not authenticated." });
  try {
    const me = await User.findById(req.session.userId);
    const target = await User.findById(req.params.targetId);
    if (!target) return res.status(404).json({ error: "User not found." });

    const isFollowing = me.following.includes(target._id);
    if (isFollowing) {
      me.following.pull(target._id);
      target.followers.pull(me._id);
    } else {
      me.following.push(target._id);
      target.followers.push(me._id);
    }
    await me.save();
    await target.save();
    res.json({
      following: !isFollowing,
      isFollowing: !isFollowing,
      followersCount: target.followers.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get All Users ──────────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not authenticated." });
  try {
    const users = await User.find({ _id: { $ne: req.session.userId } }).select(
      "-password",
    );

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const [postCount, activeStoryCount] = await Promise.all([
          Post.countDocuments({ userId: user._id }),
          Story.countDocuments({ userId: user._id, expiresAt: { $gt: new Date() } }),
        ]);
        const userObj = user.toObject();
        userObj.postsCount = postCount;
        userObj.hasActiveStory = activeStoryCount > 0;
        userObj.isFollowing = (user.followers || []).map(String).includes(req.session.userId.toString());
        return userObj;
      }),
    );

    res.json(usersWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Followers / Following Lists ───────────────────────────────────────────────
router.get("/user/:userId/followers", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });
  try {
    const user = await User.findById(req.params.userId)
      .populate("followers", "username bio profilePic followers following")
      .select("followers");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user.followers || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/user/:userId/following", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not authenticated." });
  try {
    const user = await User.findById(req.params.userId)
      .populate("following", "username bio profilePic followers following")
      .select("following");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user.following || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
