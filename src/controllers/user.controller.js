import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

//method for generateaccess and refresh token
const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});
        return {accessToken, refreshToken};

    } catch(error){
        throw new ApiError(500, "Something went wrong, while generating tokens");
    }
}

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    //check if token is present
    if(!incomingRefreshToken){
        throw new ApiError(401, "unauathorized request");
    };

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
         
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user){
            throw new ApiError(401, "Invalid token or user does not exist");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "refresh token expired or does not match");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);
        return res.status(200).cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(new ApiResponse(200, {
            accessToken, refreshToken: newRefresh
        }, "Access token refreshed successfully"))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const registerUser = asyncHandler(async (req, res) => {
    // Get user details from the user from frontend
    //validation - not empty
    //check if user already exists: username, email
    // check for images, check for avatar
    //upload them to cloudinary, avatar

    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return result

    //step 1 would be to get the data from the request body 
    //step 2 would be to validate the data
    //step 3 would be to check if the user already exists
    //step 4 would be to hash the password
    //step 5 would be to save the user to the database
    //step 6 would be to send a response to the client

    const { fullname, email, username, password } = req.body
    console.log("email", email);

    if([fullname, email, username, password].some((field) =>
        field?.trim() === "")){
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{email}, {username}]
    })

    if(existedUser) {
        throw new ApiError(409, "User already exists");
    }
    //avatar validation
    const avatarLocalPath = req.files?.avatar[0]?.path;

     if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image are required");
    }
 
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    const avatar = await uploadToCloudinary(avatarLocalPath);
    const coverImage = await uploadToCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avatar image is required");   
    }

    const user = await User.create({
        fullname, 
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong, while registering user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );
})

const loginUser = asyncHandler(async (req, res) => {
    //req body -> data
    //username and email

    //take username and password
    //validate username and password exist
    //find user based on username
    //if user not found, throw error
    //if user found, compare password
    //if password incorrect, throw error
    //if password correct, generate access token and refresh token
    //send cookies

    //return access token and refresh token to user
    const {email, username, password} = req.body;
    
    if(!username && !password){
        throw new ApiError(400, "Username or password are required");
    }

    const user = await User.findOne({
        $or: [{email}, {username}]

    })

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie(
        "accessToken", accessToken, options
    ).cookie(
        "refreshToken", refreshToken, options
    ).json(
        new ApiResponse(200, {
            user: loggedInUser, accessToken, refreshToken
        }, "User logged in successfully"),
    );
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
        $set: {refreshToken: undefined}
    }, {new: true})

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken", options)
    .clearCookie("refreshToken", options).json(
        new ApiResponse(200, {}, "User logged out successfully")
    );
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password +refreshToken");
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Old password is incorrect");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: true});

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfull")
    );
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body 

    if(!fullname || !email){
        throw new ApiError(400, "all fields are required");
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email //you can either assign a name or keep both same like in the above line
            }
        }, 
        {new: true}
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async (res, req) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on Avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        }, 
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async (res, req) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "avatar file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on cover iamge");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: coverImage.url
            }
        }, 
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})
export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage 
};