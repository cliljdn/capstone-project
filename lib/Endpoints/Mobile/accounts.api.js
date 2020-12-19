const express = require('express')
const router = express.Router()
const Accounts = require('../../../database/Model/account_table.model')
const TravelHistory = require('../../../database/Model/TravelHistory.model')
const Companions = require('../../../database/Model/Companion_Table.model')
const EmployeeProfile = require('../../../database/Model/EmployeeProfile.model')
const {
	registerValidation,
	loginValidation,
	companionEmailValidate,
} = require('../../Validations/Accounts/AccountValidation')
const bcrypt = require('bcrypt')
const { transporter, sendMail } = require('../../mailer/MailerConfig')
const jwt = require('../../Tokens/jwt')
const Establishments = require('../../../database/Model/Establishments.model')
const { establishments } = require('../../contants/TableNames')
const UserProfile = require('../../../database/Model/UserProfile.model')

// accounts login
router.post('/accounts/login', async (req, res, next) => {
	const { email, password } = req.body
	try {
		const reqBody = {
			email: email,
			password: password,
		}
		const validateData = await loginValidation.validate(reqBody, {
			abortEarly: false,
		})

		const checkedData = await Accounts.query().findOne({
			email: reqBody.email,
		})
		if (checkedData === undefined) {
			const error = new Error('Email is not registered')
			throw error
		}
		if (checkedData.isActive === 0) {
			const error = new Error('Account is not yet verified')
			throw error
		}

		const checkPass = await bcrypt.compareSync(
			reqBody.password,
			checkedData.password
		)
		if (!checkPass) {
			const error = new Error('Wrong Password')
			throw error
		}

		const token = await jwt.sign({ id: checkedData.account_id })
		if (checkedData && checkPass) {
			res.status(201).json({
				account_type: checkedData.account_type,
				auth: true,
				token: token,
			})
		}
	} catch (error) {
		next(error)
	}
})

// accounts register
router.post('/accounts/register', async (req, res, next) => {
	const { email, password, accountType } = req.body
	try {
		const accountData = {
			email: email,
			password: password,
			account_type: accountType,
		}

		const validateEntry = await registerValidation.validate(accountData, {
			abortEarly: false,
		})

		const checkIfExist = await Accounts.query().findOne({
			email: accountData.email,
		})

		if (checkIfExist) {
			const error = new Error('Email is already Registered')
			throw error
		}

		const hash = await bcrypt.hashSync(accountData.password, 10)
		if (hash) {
			const insertedData = await Accounts.query().insert({
				email: accountData.email,
				password: hash,
				account_type: accountData.account_type,
				isActive: false,
			})
			// creates a token for the user
			const token = await jwt.sign({ id: insertedData.account_id })
			// anchor tag for email
			const emailLink = `<a href="http://192.168.1.11:8080/accounts/verify/${token}" > Click to verify </a>`
			// mail credentials
			const mailOptions = {
				from: process.env.MAIL_USER,
				to: insertedData.email,
				subject: 'Verify Email',
				text: 'ScanGapo 2020',
				html: emailLink,
			}
			//sends email for registered accounts
			transporter.sendMail(mailOptions, (error, info) => {
				return error
					? console.error(error)
					: console.log(`Email sent: ${info.response}`)
			})

			if (insertedData) {
				res.status(200).json({
					created: true,
					message: 'registered',
				})
			}
		}
	} catch (error) {
		next(error)
	}
})

// create profile for regitered accounts.
router.post('/accounts/create/profile', async (req, res, next) => {
	const {
		firstName,
		lastName,
		middleName,
		birthday,
		contact,
		image,
		position,
	} = req.body

	try {
		const dataBody = {
			firstname: firstName,
			lastname: lastName,
			middlename: middleName,
			birthday: birthday,
			contactnumber: contact,
			image: image,
			position: position,
		}

		const auth = req.headers['authorization']
		if (!auth) {
			const error = new Error('No token provided')
			throw error
		}

		const decoded = await jwt.verify(auth)
		if (!decoded) {
			const error = new Error('Invalid token')
			throw error
		}

		const findAccount = await Accounts.query().findById(decoded.id)
		if (findAccount.account_type === 'User') {
			await findAccount
				.$relatedQuery('UserProfile')
				.for(findAccount.account_id)
				.insert({
					firstname: dataBody.firstname,
					lastname: dataBody.lastname,
					middlename: dataBody.middlename,
					birthday: dataBody.birthday,
					contactnumber: dataBody.contactnumber,
					image: dataBody.image,
				})
				.then(() => {
					res.status(201).json({
						created: true,
						message: 'Success',
					})
				})
		} else if (findAccount.account_type === 'Driver') {
			await findAccount
				.$relatedQuery('UserProfile')
				.for(findAccount.account_id)
				.insert({
					firstname: dataBody.firstname,
					lastname: dataBody.lastname,
					middlename: dataBody.middlename,
					birthday: dataBody.birthday,
					contactnumber: dataBody.contactnumber,
					image: dataBody.image,
					isDriver: true,
				})
				.then(() => {
					res.status(201).json({
						created: true,
						message: 'Success',
					})
				})
		} else if (findAccount.account_type === 'Employee') {
			await findAccount
				.$relatedQuery('EmployeeProfile')
				.for(findAccount.account_id)
				.insert({
					firstname: dataBody.firstname,
					lastname: dataBody.lastname,
					middlename: dataBody.middlename,
					birthday: dataBody.birthday,
					contactnumber: dataBody.contactnumber,
					position: dataBody.position,
					image: dataBody.image,
					working_in: null,
				})
				.then(() => {
					res.status(201).json({
						created: true,
						message: 'Success',
					})
				})
		}
	} catch (error) {
		next(error)
	}
})

// updates the profile
router.patch('/accounts/update/profile', async (req, res, next) => {
	const {
		firstName,
		lastName,
		middleName,
		birthday,
		contact,
		image,
		position,
	} = req.body

	try {
		const dataBody = {
			firstname: firstName,
			lastname: lastName,
			middlename: middleName,
			birthday: birthday,
			contactnumber: contact,
			image: image,
			position: position,
		}

		const auth = req.headers['authorization']
		if (!auth) {
			const error = new Error('No token provided')
			throw error
		}

		const decoded = await jwt.verify(auth)
		if (!decoded) {
			const error = new Error('Invalid token')
			throw error
		}

		const findAccount = await Accounts.query().findById(decoded.id)
		if (
			findAccount.account_type === 'User' ||
			findAccount.account_type === 'Driver'
		) {
			await findAccount
				.$relatedQuery('UserProfile')
				.for(findAccount.account_id)
				.patch({
					firstname: dataBody.firstname,
					lastname: dataBody.lastname,
					middlename: dataBody.middlename,
					birthday: dataBody.birthday,
					contactnumber: dataBody.contactnumber,
					image: dataBody.image,
				})
				.then(() => {
					res.status(201).json({
						updated: true,
						message: 'Success',
					})
				})
		} else if (findAccount.account_type === 'Employee') {
			await findAccount
				.$relatedQuery('EmployeeProfile')
				.for(findAccount.account_id)
				.patch({
					firstname: dataBody.firstname,
					lastname: dataBody.lastname,
					middlename: dataBody.middlename,
					birthday: dataBody.birthday,
					contactnumber: dataBody.contactnumber,
					position: dataBody.position,
					image: dataBody.image,
				})
				.then(() => {
					res.status(201).json({
						updated: true,
						message: 'Success',
					})
				})
		}
	} catch (error) {
		next(error)
	}
})

const fillArray = require('../../../database/Controllers/UserController')
// create for travel history
router.post('/accounts/create/travel', async (req, res, next) => {
	const { destination, accEmail } = req.body

	try {
		// AccEmail must be an array
		const travelLog = {
			location: destination,
			email: accEmail,
		}

		const auth = req.headers['authorization']
		if (!auth) {
			const error = new Error('No token provided')
			throw error
		}

		const accountId = []
		const thisParent = []
		const check = []
		const decoded = await jwt.verify(auth)
		const parentId = await Accounts.query().findById(decoded.id)
		const profile = await parentId.$relatedQuery('UserProfile')
		if (!profile) {
			const error = new Error('Account has no profile')
			throw error
		}
		let dummy = false
		if (travelLog.email === undefined || travelLog.email.length === 0) {
			if (parentId.account_type === 'Employee') {
				const error = new Error(`Invalid account type for ${parentId.email}`)
				throw error
			}

			//inserts to travel history to parent
			const checkIfEmail = await Accounts.query().findByIds(check)
			const companion = await UserProfile.query().findByIds(accountId)
			for (const users of checkIfEmail) {
				if (users.account_type === 'Employee') {
					const error = new Error(`invalid account type for ${users.email}`)
					throw error
				}
			}
			const fetchParentTravel = await profile
				.$relatedQuery('TravelHistory')
				.insertAndFetch({
					destination: travelLog.location,
					isCompanion: false,
				})

			const companionsTravel = []
			//inserts parentId to companions and inserts companions to travel table
			for (const account of companion) {
				const insertTravelCompanion = await account
					.$relatedQuery('TravelHistory')
					.insertAndFetch({
						destination: travelLog.location,
						isCompanion: true,
					})
				companionsTravel.push(
					fillArray(insertTravelCompanion.travel_id, travelLog.email.length)
				)
				const insertToCompanion = await profile
					.$relatedQuery('GetCompanions')
					.insertGraphAndFetch({
						users_id: account.user_id,
						travel_id: fetchParentTravel.travel_id,
					})
			}

			// inserts the users who they go with
			const data = await Companions.query().insertGraph({
				parent_id: profile.user_id,
				users_id: null,
				travel_id: fetchParentTravel.travel_id,
			})
		} else {
			for (let i = 0; i < travelLog.email.length; i++) {
				await companionEmailValidate.validate(
					{ email: travelLog.email[i] },
					{
						abortEarly: false,
					}
				)
				const ifExist = await Accounts.query().findOne({
					email: travelLog.email[i],
				})

				if (!ifExist) {
					const error = new Error(
						`this email does not exist ${travelLog.email[i]}`
					)
					throw error
				}
				const comProfile = await Accounts.relatedQuery('UserProfile').for(
					ifExist.account_id
				)
				accountId.push(comProfile[0].user_id)
				check.push(ifExist.account_id)
				thisParent.push(
					fillArray(comProfile[0].user_id, travelLog.email.length)
				)
				if (comProfile[0].user_id === profile.user_id) {
					const error = new Error('Cannot add yourself to companions')
					throw error
				}
			}

			if (parentId.account_type === 'Employee') {
				const error = new Error(`Invalid account type for ${parentId.email}`)
				throw error
			}

			//inserts to travel history to parent
			const checkIfEmail = await Accounts.query().findByIds(check)
			const companion = await UserProfile.query().findByIds(accountId)
			for (const users of checkIfEmail) {
				if (users.account_type === 'Employee') {
					const error = new Error(`invalid account type for ${users.email}`)
					throw error
				}
			}
			const fetchParentTravel = await profile
				.$relatedQuery('TravelHistory')
				.insertAndFetch({
					destination: travelLog.location,
					isCompanion: false,
				})

			const companionsTravel = []
			//inserts parentId to companions and inserts companions to travel table
			for (const account of companion) {
				const insertTravelCompanion = await account
					.$relatedQuery('TravelHistory')

					.insertAndFetch({
						destination: travelLog.location,
						isCompanion: true,
					})
				companionsTravel.push(
					fillArray(insertTravelCompanion.travel_id, travelLog.email.length)
				)
				const insertToCompanion = await profile
					.$relatedQuery('GetCompanions')

					.insertGraphAndFetch({
						users_id: account.user_id,
						travel_id: fetchParentTravel.travel_id,
					})
			}

			// inserts the users who they go with
			accountId.push(profile.user_id)
			for (let i = 0; i < thisParent.length; i++) {
				for (let j = 0; j < thisParent[i].length; j++) {
					accountId.push(accountId.shift())
					if (accountId[i] !== thisParent[i][j]) {
						await Companions.query().insertGraph({
							parent_id: thisParent[i][j],
							users_id: accountId[i],
							travel_id: companionsTravel[i][j],
						})
					} else {
						accountId.push(accountId.shift())
						await Companions.query().insertGraph({
							parent_id: thisParent[i][j],
							users_id: accountId[i],
							travel_id: companionsTravel[i][j],
						})
					}
				}
			}

			res.status(201).json(fetchParentTravel)
		}
	} catch (error) {
		next(error)
		console.error(error)
	}
})

//update account
router.patch('/update/account', async (req, res, next) => {
	const { email, password } = req.body
	try {
		const reqBody = {
			email: email,
			password: password,
		}

		const auth = req.headers['authorization']
		if (!auth) {
			const error = new Error('No token provided')
			throw error
		}

		const decoded = await jwt.verify(auth)
		if (!decoded) {
			const error = new Error('Invalid Token')
			throw error
		}

		const checkAcc = await Accounts.query().findById(decoded.id)
		if (checkAcc === undefined) {
			const error = new Error('No such Account')
			throw error
		}
		const hash = await bcrypt.hashSync(reqBody.password, 10)
		await Accounts.query()
			.findById(checkAcc.account_id)
			.patch({
				email: reqBody.email,
				password: hash,
			})
			.then(() => {
				res.status(201).json({
					updated: true,
					message: 'Success',
				})
			})
	} catch (error) {
		next(error)
	}
})

// verification for account
router.get('/accounts/verify/:token', async (req, res, next) => {
	const { token } = req.params
	try {
		const decoded = await jwt.verify(token)
		if (!decoded) {
			const error = new Error('Invalid Token')
			throw error
		}

		const checkAcc = await Accounts.query().findById(decoded.id)
		if (checkAcc === undefined) {
			const error = new Error('No such user')
			throw error
		}
		if (checkAcc.isActive === 1) {
			const error = new Error('Account is already Verified')
			throw error
		}

		if (checkAcc) {
			const activatedAcc = await checkAcc.$query().patch({
				isActive: true,
			})
			res.status(200).json({
				email: checkAcc.email,
				account_type: checkAcc.account_type,
				verified: true,
				message: 'verified',
			})
		}
	} catch (error) {
		next(error)
	}
})

// post request for employee working in
router.post('/account/establishment/create', async (req, res, next) => {
	const { establishment_id } = req.body
	try {
		console.log(establishment_id)
		const auth = req.headers['authorization']
		if (!auth) {
			const error = new Error('No token provided')
			throw error
		}

		const decoded = await jwt.verify(auth)
		if (!decoded) {
			const error = new Error('Invalid token')
			throw error
		}

		const findEmployee = await Accounts.query().findById(decoded.id)
		const empProfile = await EmployeeProfile.query().where(
			'profile_owner',
			findEmployee.account_id
		)

		if (findEmployee === undefined || empProfile === undefined) {
			const error = new Error('Cannot find profile')
			throw error
		}
		if (findEmployee.isActive === 0) {
			const error = new Error('Account is not yet verified')
			throw error
		}

		const estData = await Establishments.query().findById(establishment_id)
		if (estData === undefined) {
			const error = new Error('Establishment does not exist')
			throw error
		}
		if (estData.isActive === 0) {
			const error = new Error('Establishment is not yet verified')
			throw error
		}

		const thisProfile = await empProfile[0]
			.$query()
			.patchAndFetch({
				working_in: estData.establishment_id,
			})
			.then(() => {
				res.status(201).json({
					updated: true,
					message: 'Successfully inserted work info',
				})
			})
	} catch (error) {
		next(error)
	}
})

module.exports = router