### 📝 JLPT Online Registration Bot

A Puppeteer-based automation bot designed to help speed up the process of filling out the JLPT Online Indonesia registration form.

### ⚠️ Important Notice

Make sure all required data has been entered before running the application.

### Installation & Running the Project

```bash
npm install
npm run start
```

#### Folder Structure

```
project-bot/
├── credentials/
│   └── private/
│       └── rudi-credentials.json  <-- buat file JSON di sini
└── images/
    └── foto-ku.jpg                <-- simpan foto kamu di sini
```

#### Features

- Automatically fills in complete profile information (name, date of birth, phone number, address)
- Automatically fills in email and password on the login page
- Supports selection of test locations from 14 cities in Indonesia
- Supports all JLPT levels (N1–N5)
- Automatically uploads photos from the images folder

#### Limitations

- There are still some limitations when automatically filling in dropdown/select fields. However, if you encounter any issues, you can fill them in manually.
- Because the JLPT website uses reCAPTCHA, you must click the CAPTCHA and the submit button manually. We still cannot select data from dropdown inputs—you need to do it manually!

#### Flow

- The bot reads the file from credentials/private/.
- The browser automatically opens the JLPT Online website.
- The bot fills in the email and password.
- [MANUAL] You must complete the reCAPTCHA and click “Login.”
- After logging in, the bot automatically goes to the registration page and fills in the profile, address, photo, level, and location.
- [SEMI-MANUAL] Manually select options from the dropdown fields if necessary.

#### Notes

- This tool automatically fills out the JLPT website registration form with pre-configured data for the Indonesian region. It is designed to speed up the registration process and minimize manual input errors.
- The region data is complete, but the city data isn’t fully filled in. It only includes stuff like "Bali", "Jakarta", "West Java", "Yogyakarta", etc. Other cities aren’t included because I was lazy to collect them
