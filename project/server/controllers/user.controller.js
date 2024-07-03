import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


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


const registerUser = asyncHandler(async(req,res)=>{
    //getting values from the frontend
    const {email,fullname,password,username} = req.body;
    console.log("email: ",email); // testing to be done using postman 
    
    //basically want to throw error if the name is empty 
    //validation step the fileds should not be empty
    if([fullname,email,password,username]
        .some((field)=>field?.trim === "")
    ){
        throw new ApiError(400,"All fields are required")
    }

    //check if user already exists 
    //this process here returns the first user it finds with that email and name
    const existingUsername = await User.findOne({
        $or : [ { username }]
    })
    const existingEmail = await User.findOne({
        $or: [ { email} ]
    })
    if(existingUsername){
        throw new ApiError(409,"Username Already Exists")
    }
    else if(existingEmail){
        throw new ApiError(409,"EmailId already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath =  req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(409,"Avatar file is required")
    }
    //servers take time 

    const avatar = await uploadOnCloudinary(avatarLocalPath); // we do not have to go ahead until and unless this is completed
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(409,"Avatar file is required")
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        //we need to check if or not coverimage is present or no 
        //if coverImage there then put the url else keep it empty
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User Registered Successfully")
    )//everything went alright



})

const loginUser = asyncHandler(async(req,res)=>{
    const {email,username,password} = req.body; //got data from body
    console.log(password)
    if(!username && !email){
        throw new ApiError(400,"Username or password is required")
    } //checked email and password given or not
    const user = await User.findOne({
        $or: [{username}, {email}]
    }) //this is us finding the value in our database 
    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    //if username email not found the user doesnt exist
    //now we know that user exists now we will be checking password using bcrypt
    const isPasswordValid = await user.isPasswordCorrect(password)
    console.log(isPasswordValid)
    if(!isPasswordValid){
        throw new ApiError(401,"Password is incorrect")
    }
    //now checking password
    //access and refresh tokens

    const {accessToken, refreshToken} = await generateRefreshAndAccessToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    //cookies can be only accessed through the server and not the frontend
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

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"current user"))
})




export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
   
    getCurrentUser,
}


// no export default so it can be imoorted like this