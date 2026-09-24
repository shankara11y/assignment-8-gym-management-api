# 🏋️‍♂️ Assignment 08: Gym & Fitness Club Management REST API

A full-featured backend REST API for a **Gym & Fitness Center Management System** built with Node.js, Express.js, MongoDB, Mongoose, Passport.js (Local Strategy), and Express-Session.

---

## 🛠️ Tech Stack & Dependencies

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Passport.js (`passport-local`) & `express-session`
- **Security**: `bcryptjs` for password hashing
- **Environment Management**: `dotenv`
- **CORS**: `cors`
- **Testing**: `mongodb-memory-server` & custom integration test runner

---

## 🏗️ Project Architecture

```text
assignment-08-gym-api/
├── config/
│   ├── db.js                # MongoDB connection handler
│   └── passport.js          # Passport Local strategy setup
├── controllers/
│   ├── authController.js    # Register, login, logout, profile handlers
│   ├── classController.js   # Class CRUD & capacity booking logic
│   └── memberController.js  # Renewal & expired query handlers
├── middleware/
│   ├── authMiddleware.js    # Session authentication check
│   └── checkActiveMember.js # Active & unexpired membership validator
├── models/
│   ├── FitnessClass.js      # Workout class Mongoose schema
│   └── User.js              # Member schema with bcrypt pre-save hook
├── routes/
│   ├── authRoutes.js        # Auth endpoints (/api/auth)
│   ├── classRoutes.js       # Class & booking endpoints (/api/classes)
│   └── memberRoutes.js      # Member management endpoints (/api/members)
├── test/
│   └── api.test.js          # In-memory Mongo integration test suite
├── .env                     # Local environment file
├── .env.example             # Example environment file
├── .gitignore               # Git ignore rules
├── package.json             # NPM dependencies & scripts
├── postman_collection.json  # Exported Postman test suite
├── server.js                # Express application entry point
└── README.md                # Documentation
```

---

## 🔐 API Endpoints Specification

### 1. Authentication (`/api/auth`)

| Method | Endpoint | Description | Request Body Example | Status Codes |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Register new member & calculate plan expiry date | `{"username":"fit_sam","email":"sam@fit.com","password":"mypassword","membershipTier":"Gold","durationMonths":3}` | `201 Created`, `400 Bad Request` |
| `POST` | `/api/auth/login` | Login via Passport Local strategy | `{"username":"fit_sam","password":"mypassword"}` | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/auth/me` | Fetch profile & calculated remaining days | None | `200 OK`, `401 Unauthorized` |
| `POST` | `/api/auth/logout` | Destroy session & logout member | None | `200 OK`, `401 Unauthorized` |

### 2. Fitness Classes (`/api/classes`)

| Method | Endpoint | Description | Request Body Example | Status Codes |
|---|---|---|---|---|
| `GET` | `/api/classes` | Fetch all upcoming classes (supports `?trainer=Maria`) | None | `200 OK` |
| `GET` | `/api/classes/:id` | Get class details with enrolled members list | None | `200 OK`, `404 Not Found` |
| `POST` | `/api/classes` | Create a new workout class | `{"title":"Zumba Cardio","trainerName":"Maria","scheduleDate":"2026-04-15T09:00:00Z","maxCapacity":20}` | `201 Created`, `400 Bad Request` |
| `POST` | `/api/classes/:id/book` | Enroll logged-in user (Fails if full or expired) | None | `200 OK`, `400 Bad Request` |
| `DELETE` | `/api/classes/:id/cancel` | Cancel member booking from class | None | `200 OK`, `400 Bad Request` |

### 3. Membership Management (`/api/members`)

| Method | Endpoint | Description | Request Body Example | Status Codes |
|---|---|---|---|---|
| `PATCH` | `/api/members/:id/renew` | Renew / extend membership expiry date & tier | `{"additionalMonths": 6, "tier": "Platinum"}` | `200 OK`, `404 Not Found` |
| `GET` | `/api/members/expired` | Get list of all expired memberships | None | `200 OK` |

---

## 🚦 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create `.env` file (or copy `.env.example`):

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gym_db
SESSION_SECRET=your_secret_session_key
```

### 3. Run Server

- **Development Mode**:
  ```bash
  npm run dev
  ```

- **Production Mode**:
  ```bash
  npm start
  ```

---

## 🧪 Testing & Validation

Run the automated integration test suite:

```bash
npm test
```

### Test Coverage:
1. **Member Registration**: Calculates `membershipExpiryDate` exactly 30 days in the future for 1 month duration.
2. **Profile & Remaining Days**: `/api/auth/me` returns dynamic remaining active days.
3. **Capacity Validation**: Creates class with `maxCapacity = 2`. Booking a 3rd member fails with `400 Bad Request: Class capacity reached`.
4. **Expired Membership Prevention**: Restricts expired members from booking classes.
5. **Expired Members Query**: `/api/members/expired` returns all members past their expiry date.
6. **Renewal Logic**: Extends expiry date and updates tier.

---

## 📬 Postman Test Suite

Import `postman_collection.json` into Postman to test all endpoints. Set `baseUrl` variable to `http://localhost:5000`.
