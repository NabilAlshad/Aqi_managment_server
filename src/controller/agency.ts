import { NextFunction, Request, Response } from "express"
import { AgencyRegistration } from "../dto/agency/registration.dto"
import { Agency } from "../entites/Agency"
import {
    unlink, unlinkSync
} from "fs"
import {
    uploadAnyImage,
    uploadDefaultPicture
} from "../../utils/uploadPicture"
import bcrypt from "bcrypt"
import {
    validate
} from "class-validator"
import {
    body
} from "express-validator"
import {
    LoginValidator
} from "../dto/agency/loginValidator.dto"

//utils modules
import jwtGenerator from "../../utils/generateJWT"
import cookieOption from "../../utils/cookiesOption"
import otpGenerator from "../../utils/otpGenerator"
import sendMailer from "../../utils/sendMail"
import jwtVerifier from "../../utils/verifyToken"
import fileDeleteHandler from "../../utils/deleteFileFromPublic"

//dto input validation  module
import {
    ForgoPasswordVerifyEmailValidator as VerifyEmailValidator,
    ForgoPasswordVerifyOtpValidator as OtpValidator,
    ForgoPasswordVerifyResetPasswordValidator as ResetPasswordValidator
} from "../dto/agency/forgotPassword.dto"
import {
    UpdateProfileValidator
} from "../dto/agency/updateProfile.dto"
import {
    ProfilePictureUpdateValidator
} from "../dto/agency/profilePictureUpdateValidator.dto"
import {
    UpdateCurrentPasswordValidator
} from "../dto/agency/updateCurrentPassword.dto"

//local type
type Body = (req: Request, res: Response, next: NextFunction) => Promise<void> //body type
type UploadFileReturn = {
    fileUrl: string,
    fileAddStatus: boolean
} //type declare for upload file return statement


//register a new agency 
const registerNewAgencyHandler: Body = async (req, res, next) => {
    try {
        const registrationData: AgencyRegistration = req.body //take the data from body
        // console.log(req.body)
        //validation part start from here
        const checkRegistrationData: AgencyRegistration | any = new AgencyRegistration();
        for (const property in req.body) {
            checkRegistrationData[property] = req.body[property]
        } //store all body data dynamically into the validation instance
        const isValidationError = await validate(checkRegistrationData) //validate the input data here
        if (isValidationError.length) { //if validation failed
            res.json({
                message: isValidationError,
                status: 402
            })
        } else {
            //password and confirm password validation
            registrationData.password != registrationData.confirmPassword
                &&
                (
                    res.json({
                        message: "Confirm Password does not match with password",
                        status: 406
                    })
                )
            //validation part end here

            const checkAlreadyRegistered: Agency | null = await Agency.createQueryBuilder("agency")
                .where("agency.email = :e", { e: registrationData.email })
                .select(["agency.email"])
                .getOne() //check that is there have any data available or not by email
            if (checkAlreadyRegistered) { //if user found
                res.json({
                    message: "Email is already registered please try with another email",
                    status: 406
                })
            } else {

                const encryptedPassword: string = await bcrypt.hash(registrationData.password, 10);
                const newAgency: Agency | any = await new Agency(); //create a instance of agency
                for (const property in registrationData) { //store the agency data dynamically
                    property != "confirmPassword" && (newAgency[property] = req.body[property])
                } //insert data into agency 
                newAgency.password = encryptedPassword //insert the encrypted password
                //upload the title pic part
                if (req.body.titlePic) { //if title picture provided
                    const {
                        fileAddStatus,
                        fileUrl
                    }: UploadFileReturn = await uploadAnyImage(req.body.titlePic, req.body.name)
                    fileAddStatus
                        ?
                        newAgency.titlePic = fileUrl //insert the picture url 
                        :
                        res.json({
                            message: "Title picture upload failed please try again",
                            status: 406
                        })

                } else { //if title picture base 64 does not provide 

                    const {
                        fileUrl,
                        fileAddStatus
                    }: UploadFileReturn = await uploadDefaultPicture("title", req.body.name)
                    fileAddStatus
                        ?
                        newAgency.titlePic = fileUrl //insert the picture url 
                        :
                        res.json({
                            message: "Title default picture upload failed please try again",
                            status: 406
                        })
                }

                //upload the cover pic part
                if (req.body.coverPic) { //if title picture provided
                    const {
                        fileAddStatus,
                        fileUrl
                    }: UploadFileReturn = await uploadAnyImage(req.body.coverPic, req.body.name)
                    fileAddStatus
                        ?
                        newAgency.coverPic = fileUrl //insert the picture url 
                        :
                        res.json({
                            message: "Cover picture upload failed please try again",
                            status: 406
                        })

                } else { //if title picture base 64 does not provide 

                    const {
                        fileUrl,
                        fileAddStatus
                    }: UploadFileReturn = await uploadDefaultPicture("cover", req.body.name)
                    fileAddStatus
                        ?
                        newAgency.coverPic = fileUrl //insert the picture url 
                        :
                        res.json({
                            message: "Cover default picture upload failed please try again",
                            status: 406
                        })
                }
                const saveNewAgency: Agency = await newAgency.save(); //save the agency here
                if (Object.keys(saveNewAgency).length) { //if agency successfully save
                    res.json({
                        message: "Agency successfully saved",
                        status: 201
                    })
                } else {
                    res.json({
                        message: "Agency failed to save",
                        status: 400
                    })
                }
            }
        }
    } catch (err) {
        console.log(err)
        res.json({
            message: "Internal Error!!",
            status: 406
        })
    }
}

//create login api 
const loginController: Body = async (req, res, next) => {
    try {
        // console.log(`It is heades`)
        //input data validation start
        const loginData: LoginValidator | any = new LoginValidator()  //create a instance for validate the login input data
        for (const property in req.body) {
            loginData[property] = req.body[property]
        } //store all body data dynamically into the validation instance
        const isValidationError = await validate(loginData) //validate the login input data with
        if (isValidationError.length) { //if there have some body input error
            res.json({ //if there have some validation error
                message: isValidationError,
                status: 402,
                agency: null
            })
        } else {
            const {
                emailOrAgentId,
                password: inputPassword
            }: {
                emailOrAgentId: string,
                password: string
            } = req.body
            const findAgency: Agency | null = await Agency.createQueryBuilder("agency")
                .where("agency.email = :e", { e: emailOrAgentId })
                .orWhere("agency.agentID = :id", { id: emailOrAgentId })
                .select(
                    [
                        "agency.coverPic",
                        "agency.titlePic",
                        "agency.name",
                        "agency.agentID",
                        "agency.email",
                        "agency.area",
                        "agency.district",
                        "agency.division",
                        "agency.country",
                        "agency.motive",
                        "agency.password",
                        "agency.userType"
                    ]
                )
                .getOne() //query by email and select only the email of that agency 
            // console.log(`Hello world`)
            // console.log(findAgency)
            if (findAgency) { //if find agency the it will happen
                const { password: databasePassword, agentID, email: agentEmail } = findAgency //get the database password 
                const isPasswordMatch: boolean = await bcrypt.compare(inputPassword, databasePassword)
                if (isPasswordMatch) { //if the password match
                    const tokenData = {
                        id: agentID,
                        email: agentEmail
                    } //auth toke data
                    const tokenDeadLine: string = process.env.TOKE_EXPIRE_IN || "5d"
                    const cookiesDeadline: number = +process.env.COOKIE_EXPIRE_IN! || 5
                    const token: string = jwtGenerator(tokenData, tokenDeadLine)
                    const optionForCookie = cookieOption(cookiesDeadline)
                    const responseData: object = {
                        name: findAgency.name,
                        area: findAgency.area,
                        district: findAgency.district,
                        division: findAgency.division,
                        country: findAgency.country,
                        titlePic: findAgency.titlePic,
                        coverPic: findAgency.coverPic,
                        motive: findAgency.motive,
                        email: findAgency.email,
                        agentID: findAgency.agentID
                    }
                    res.cookie("auth", token, optionForCookie).json({
                        message: "Login Successfully!!",
                        agency: responseData,
                        status: 202
                    })
                } else {
                    res.json({
                        message: "Password mismatch",
                        status: 406,
                        agency: null
                    })
                }
            } else {
                res.json({
                    message: "Agency not found",
                    status: 404,
                    agency: null
                })
            }
        }
        //input data validation end 


    } catch (err) {
        console.log(err)
        res.json({
            message: "Internal error!!",
            status: 406,
            agency: null
        })
    }
}





export {
    registerNewAgencyHandler,
    loginController
}
