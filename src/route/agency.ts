import {
    Router,
    Request
} from "express"
import {
    registerNewAgencyHandler,
    loginController
} from "../controller/agency"
import auth from "../../middleware/auth"

const route = Router();

//post route
route.post("/registration", registerNewAgencyHandler)
route.post("/login", loginController)

export default route


