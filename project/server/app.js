import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { verifyJWT } from './middlewares/auth.js';
import { User } from './models/user.model.js';
import { ApiResponse } from './utils/ApiResponse.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { ApiError } from './utils/ApiError.js';

const app = express();
const   PORT = 3000;

// Get the current directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, '../client/public')));

// Route for the homepage
app.get('/', async(req, res) => {
  res.sendFile(path.join(__dirname, '../client/public', 'index.html'));
});
app.post('/signup',async(req,res)=>{
  const {username,email,password} = req.body;
  if(!username || !email || !password){
    res.status(400).send('All values need to be inserted')
  }
  const existingUsername = await User.findOne({ username })
  const existingEmail = await User.findOne( { email} )
if(existingUsername){
    throw new ApiError(409,"Username Already Exists")
}
else if(existingEmail){
    throw new ApiError(409,"EmailId already exists");
}
const user = await User.create({
  username:username,
  email,
  password,
  
})

const createdUser = await User.findById(user._id).select(
  "-password -refreshToken"
)

if(!createdUser){
  throw new ApiError(500,"something went wrong while registering the user")
}

return res.status(201).json(
  new ApiResponse(200,createdUser,"User Registered Successfully")
)


})
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Implement your authentication logic here
  if (email === 'user@example.com' && password === 'password') {
    res.redirect('/dashboard');
  } else {
    res.status(401).send('Invalid credentials');
  }
});




// Route for the dashboard page
app.get('/dashboard', verifyJWT,(req, res) => {
  res.sendFile(path.join(__dirname, '../client/public', 'dashboard.html'));
});


// Handle login request




// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app, server };
