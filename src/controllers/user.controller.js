import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export { registerUser };