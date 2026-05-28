# 📸 GMinsta — Mini Social Media Application

**Course:** Unstructured Data and NoSQL Technologies (UE24CS2404)  
**Assignment:** 01 | **Level:** 3 (Advanced)  
**University:** GM University, Davangere

---

## 🚀 Features

| Feature | Level |
|---|---|
| User Registration & Login | L1 |
| Password Hashing (bcryptjs) | L1 |
| Session-based Authentication | L1 |
| Create Post (image/text) | L2 |
| View Feed | L2 |
| Like / Dislike Posts | L2 |
| Comments | L2 |
| User Profile + Edit | L3 |
| Follow / Unfollow | L3 |
| Real-time Chat / Messaging | L3 |
| MongoDB Atlas Ready | L3 |

---

## 🗂 Project Structure

```
GMinsta/
├── models/
│   ├── User.js
│   ├── Post.js
│   ├── Comment.js
│   └── Message.js
├── routes/
│   ├── authRoutes.js
│   ├── postRoutes.js
│   ├── commentRoutes.js
│   └── chatRoutes.js
├── public/
│   ├── css/style.css
│   └── images/uploads/
├── views/
│   ├── login.html
│   ├── register.html
│   ├── home.html
│   ├── profile.html
│   └── chat.html
├── app.js
├── package.json
└── README.md
```

---

## ⚙️ Setup & Run

### Prerequisites
- Node.js v16+
- MongoDB (local or Atlas)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start with local MongoDB
node app.js

# OR with MongoDB Atlas
MONGO_URI="mongodb+srv://<user>:<pass>@cluster.mongodb.net/gminsta" node app.js
```

Open **http://localhost:3000**

---

## 🗄 MongoDB Collections

### users
```json
{
  "_id": "ObjectId",
  "username": "john_doe",
  "email": "john@gmail.com",
  "password": "<hashed>",
  "bio": "I love coding",
  "profilePic": "default-avatar.png",
  "followers": [],
  "following": [],
  "createdAt": "2026-03-30"
}
```

### posts
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "caption": "Hello from GMinsta!",
  "image": "/images/uploads/post.jpg",
  "likes": ["userId1"],
  "dislikes": [],
  "createdAt": "2026-03-30"
}
```

### comments
```json
{
  "_id": "ObjectId",
  "postId": "ObjectId",
  "userId": "ObjectId",
  "commentText": "Awesome post!",
  "createdAt": "2026-03-30"
}
```

### messages
```json
{
  "_id": "ObjectId",
  "senderId": "ObjectId",
  "receiverId": "ObjectId",
  "messageText": "Hi, how are you?",
  "createdAt": "2026-03-30"
}
```

---

## 🧪 Test Accounts (after running)

Register two accounts and test: login, posting, liking, commenting, and chatting.

---

## 📦 Submission Files

| File | Description |
|---|---|
| `USN_UDNT_A1_Report.pdf` | Assignment report |
| `USN_UDNT_A1_Project.zip` | This project zipped |
| `USN_UDNT_A1_Testcases.pdf` | Test cases document |
| `USN_UDNT_A1_Screenshot*.jpg` | App screenshots |
| YouTube URL | Video walkthrough |
