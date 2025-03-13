require("dotenv").config();

const puppeteer = require("puppeteer");
const { students } = require("./resources");

const { common, helpers } = require("./utils");

const credentials = {
  email: students.email,
  password: students.password,
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  page.setDefaultTimeout(30000);

  try {
    console.log("#1. Starting automation process...");

    console.log("#2. Navigating to login page...");
    await page.goto("https://jlptonline.or.id/signin", {
      waitUntil: "networkidle2",
    });

    console.log("#3. Filling login credentials...");
    await page.waitForSelector(".auth");
    await page.type("#email", credentials.email);
    await page.type("#password", credentials.password);

    console.log("#4. Submitting login form...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('button[type="submit"]'),
    ]);

    if (await page.$(".auth")) {
      throw new Error("#4.1 😒 Login failed - auth form still present");
    }

    console.log("#4.1 🥳 Login successful");

    console.log("#4.2 Navigating to test page...");
    await page.goto(
      `https://jlptonline.or.id/test?location=${students.locationTest.jakarta}&grade=${students.jlptLevel}`,
      {
        waitUntil: "networkidle2",
      }
    );

    console.log("#5. Clicking test button...");
    await page.waitForSelector("a.themeBtn--outline.themeBtn--wide.w-100");

    let maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2" }),
          page.click("a.themeBtn--outline.themeBtn--wide.w-100"),
        ]);

        break;
      } catch (err) {
        console.log(`Attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt === maxRetries - 1) throw err;
        await helpers.delay(1000);
      }
    }

    console.log("#6. Handling modal dialog...");
    await page
      .waitForSelector(".section__navbar.profile", { timeout: 5000 })
      .then(() => console.log("Profile navbar loaded successfully"))
      .catch(() => console.warn("Profile navbar not found, continuing anyway"));

    const modalExists = await page.$(".modal.show");

    if (modalExists) {
      console.log("Modal dialog detected, attempting to close...");
      const exactButtonSelector =
        'button.themeBtn.themeBtn--wide.w-100[data-bs-dismiss="modal"]';
      try {
        await page.click(exactButtonSelector);
        await page
          .waitForFunction(() => !document.querySelector(".modal.show"), {
            timeout: 3000,
          })
          .catch(() => {});
      } catch (error) {
        await page.evaluate(() => {
          const modalButton = document.querySelector(
            'button.themeBtn.themeBtn--wide.w-100[data-bs-dismiss="modal"]'
          );
          if (modalButton) modalButton.click();
        });
      }
    }

    console.log("#7. Waiting for form fields...");
    const formFields = ["#passcode", "#telephone", "#postal_code", "#alamat"];
    await Promise.all(
      formFields.map((field) =>
        page
          .waitForSelector(field, { timeout: 5000 })
          .catch((err) =>
            console.warn(`Field ${field} not found: ${err.message}`)
          )
      )
    );

    console.log("#8. Filling form fields...");
    if (!students) {
      throw new Error("Student data is missing or undefined");
    }

    await page.type("#passcode", students?.passcode || "");
    await page.type("#telephone", students?.profile?.phone || "");
    await page.type("#postal_code", students?.address?.postal_code || "");
    await page.type("#alamat", students?.address?.street || "");

    await common.setDateInput(page, students?.profile?.birth_date || "");

    console.log("#9. Selecting checkboxes (Buku, Animasi, Komik)...");

    console.log("#7. Waiting for checkbox container to be ready...");
    await page.waitForSelector(".custom-form__border", {
      visible: true,
      timeout: 6000,
    });

    console.log("#8. Selecting checkboxes...");
    await common.setSelectedCheckbox(page, {
      checkboxIds: ["31", "29", "32"],
      isExclusive: false,
      duration: 500,
    });
    console.log("#9. Checkboxes Normal successfully selected");

    console.log("#10. Selecting exclusive checkbox (Manga)...");
    await common.setSelectedCheckbox(page, {
      checkboxIds: [
        "with_teacher_36",
        "with_teacher_37",
        "with_teacher_38",
        "with_teacher_39",
      ],
      isExclusive: false,
      duration: 500,
    });

    await helpers.delay(500);

    await common.setSelectedCheckbox(page, {
      checkboxIds: [
        "with_friend_41",
        "with_friend_42",
        "with_friend_43",
        "with_friend_44",
      ],
      isExclusive: false,
      duration: 500,
    });

    await helpers.delay(500);

    await common.setSelectedCheckbox(page, {
      checkboxIds: [
        "with_family_46",
        "with_family_47",
        "with_family_48",
        "with_family_49",
        "with_family_50",
      ],
      isExclusive: true,
      duration: 500,
    });

    await helpers.delay(500);

    await common.setSelectedCheckbox(page, {
      checkboxIds: [
        "with_boss_51",
        "with_boss_52",
        "with_boss_53",
        "with_boss_54",
        "with_boss_55",
      ],
      isExclusive: true,
      duration: 500,
    });

    await helpers.delay(500);

    await common.setSelectedCheckbox(page, {
      checkboxIds: [
        "with_colleague_56",
        "with_colleague_57",
        "with_colleague_58",
        "with_colleague_59",
        "with_colleague_60",
      ],
      isExclusive: true,
      duration: 500,
    });

    await helpers.delay(500);

    await common.setSelectedCheckbox(page, {
      checkboxIds: [
        "with_customer_61",
        "with_customer_62",
        "with_customer_63",
        "with_customer_64",
        "with_customer_65",
      ],
      isExclusive: true,
      duration: 500,
    });

    await helpers.delay(500);

    console.log("#11. Exclusive checkbox Manga successfully selected");

    await common.setCheckAgreementBox(page, 1000);
    await common.setUploadLocalProfilePhoto(page, students.photoName);

    console.log("#12. CHECKBOX AGREEMENT SUCCESSFULLY SELECTED");
  } catch (error) {
    console.error("Automation error:", error.message);
  } finally {
    console.log("Automation process completed");
  }
})();
