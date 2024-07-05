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
const generateRefreshAndAccessToken = async(userId)=>{
  try{
      const user = await User.findById(userId);  //this is an object
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      user.refreshToken = refreshToken; //saving refreshtoken in our database
      await user.save({validateBeforeSave: false});
      return{accessToken,refreshToken}
  }
  catch(error){
      throw new ApiError(500,"something went wrong while generating access and refresh token")
  }
}

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
app.post('/login', async  (req, res) => {
  const {email,password} = req.body;
  if(!email || !password){
    res.status(400).send('All values need to be inserted')
  }
  const user = await User.findOne({
    $or: [{email}]
}) 
if(!user){
    throw new ApiError(404,"User does not exist")
}

const isPasswordValid = await user.isPasswordCorrect(password)
console.log(isPasswordValid)
if(!isPasswordValid){
    throw new ApiError(401,"Password is incorrect")
}

const {accessToken, refreshToken} = await generateRefreshAndAccessToken(user._id);
const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
const options = {
    httpOnly:true,
    secure:true
}

return res
.status(200)
.cookie("accessToken",accessToken,options)
.cookie("refrehToken",refreshToken,options)
.json(
    
    new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken,
                refreshToken
            },
            "User logged in Successfully"
    )
    
)
})
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public', 'login.html'));
});


const logoutUser = asyncHandler(async(req,res)=>{
await User.findByIdAndUpdate(
    req.user._id,
    {
        $set:{
            refreshToken:undefined
        }
    },
    {
        new:true
    }
)
const options = {
    httpOnly:true,
    secure:true
}
return res
.status(200)
.clearCookie("accessToken",options)
.clearCookie("refreshToken",options)
.json(new ApiResponse(200,{},"User Logged Out"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
//in case of a mobile application we would not have cookies
// step one is to get the token
if(!incomingRefreshToken){
    throw new ApiError(401,"unauthorized request")
} 
//if no refresh token we are throwing the above error 
//next step is to verify using jwt
try {
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    // jwt.verify takes two inputs the incoming token and the refresh token 
    //now finding user by the id we get from the decodedToken
    const user = await User.findById(decodedToken?._id);
    if(!user){
        throw new ApiError(401,"Invalid Refresh Token")
    }
    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401,"Refresh token is expired or used")
    }

    const options ={
        httpOnly:true,
        secure:true
    }

    const {accessToken,newRefreshToken} = await generateRefreshAndAccessToken(user?._id)

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
        new ApiResponse(
            200,
            {accessToken,newRefreshToken},
            "Access token refreshed"
        )
    ) 
} catch (error) {
    throw new ApiError(401,error?.message || "Invalid Refresh Token")
    
}
})


// Route for the dashboard page
app.get('/dashboard', verifyJWT,(req, res) => {
  res.sendFile(path.join(__dirname, '../client/public', 'dashboard.html'));
});

app.get('/game1-description.html',verifyJWT,(_,res) =>{
  res.sendFile(path.join(__dirname, '../client/games/autism/game1desc.html', ''));
})
app.get('/client/autism/game1.html',verifyJWT,(_,res) =>{
  res.sendFile(path.join(__dirname, '../client/games/autism/game1.html', ''));

})


// Handle login request




// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app, server };
