require('dotenv').config()
// Update with your config settings.
module.exports = {
	development: {
		client: 'mysql',
		connection: {
			host: process.env.DB_HOST,
			database: 'capstonedb',
			user: 'root',
			password: '',
			timezone: 'UTC',
			dateStrings: true,
		},
		pool: {
			min: 2,
			max: 10,
		},
		migrations: {
			directory: './database/migrations',
		},
		seeds: {
			directory: './database/seeds',
		},
	},
}