const path = require("path");

const moduleExport = {
  helpers: {
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
  common: {
    setSelectedCheckbox: async (page, options) => {
      const { checkboxIds, isExclusive, duration = 1000 } = options;

      if (
        !checkboxIds ||
        !Array.isArray(checkboxIds) ||
        checkboxIds.length === 0
      ) {
        console.error("❌ Error: checkboxIds must be a non-empty array");
        console.error("Received:", checkboxIds);
        return;
      }

      console.log(
        `Processing ${isExclusive ? "EXCLUSIVE" : "REGULAR"} checkbox group:`,
        checkboxIds
      );

      if (isExclusive) {
        const lastId = checkboxIds[checkboxIds.length - 1];

        try {
          const lastElementExists = await page.evaluate((id) => {
            return !!document.getElementById(id);
          }, lastId);

          if (!lastElementExists) {
            console.error(`❌ Last checkbox #${lastId} not found in DOM`);
            return;
          }

          const isAlreadyChecked = await page.evaluate((checkboxId) => {
            const checkbox = document.getElementById(checkboxId);
            return checkbox ? checkbox.checked : false;
          }, lastId);

          if (!isAlreadyChecked) {
            try {
              const labelExists = await page.evaluate((id) => {
                return !!document.querySelector(`label[for="${id}"]`);
              }, lastId);

              if (labelExists) {
                await page.click(`label[for="${lastId}"]`);
              } else {
                await page.click(`#${lastId}`);
              }
              console.log(
                `✅ Last checkbox #${lastId} checked (exclusive mode)`
              );
            } catch (clickError) {
              await page.evaluate((id) => {
                const checkbox = document.getElementById(id);
                if (checkbox) {
                  checkbox.checked = true;
                  checkbox.dispatchEvent(
                    new Event("change", { bubbles: true })
                  );
                }
              }, lastId);
              console.log(
                `✅ Last checkbox #${lastId} checked via JavaScript (exclusive mode)`
              );
            }
          } else {
            console.log(
              `✅ Last checkbox #${lastId} already checked (exclusive mode)`
            );
          }

          for (let i = 0; i < checkboxIds.length - 1; i++) {
            const id = checkboxIds[i];
            await page.evaluate((checkboxId) => {
              const checkbox = document.getElementById(checkboxId);
              if (checkbox) {
                checkbox.disabled = true;
                checkbox.checked = false;
                checkbox.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }, id);
            console.log(
              `🔒 Checkbox #${id} disabled and unchecked (exclusive mode)`
            );
          }
        } catch (error) {
          console.log(
            `❌ Failed to process exclusive checkbox group: ${error.message}`
          );
        }
        return;
      }

      for (const id of checkboxIds) {
        console.log(`Selecting checkbox #${id}...`);

        const elementExists = await page.evaluate((checkboxId) => {
          return !!document.getElementById(checkboxId);
        }, id);

        if (!elementExists) {
          console.error(`❌ Checkbox #${id} not found in DOM, skipping`);
          continue;
        }

        const isAlreadyChecked = await page.evaluate((checkboxId) => {
          const checkbox = document.getElementById(checkboxId);
          return checkbox ? checkbox.checked : false;
        }, id);

        if (isAlreadyChecked) {
          console.log(`Checkbox #${id} is already checked, skipping.`);
          continue;
        }

        try {
          const labelExists = await page.evaluate((id) => {
            return !!document.querySelector(`label[for="${id}"]`);
          }, id);

          if (labelExists) {
            await page.click(`label[for="${id}"]`);
            await delay(100);
          } else {
            throw new Error("Label not found, trying direct click");
          }

          const isChecked = await page.evaluate((checkboxId) => {
            const checkbox = document.getElementById(checkboxId);
            return checkbox ? checkbox.checked : false;
          }, id);

          if (isChecked) {
            console.log(
              `✅ Checkbox #${id} successfully checked (label click).`
            );
          } else {
            throw new Error("Checkbox not checked after label click");
          }
        } catch (error) {
          console.log(`⚠️ Label click failed for #${id}: ${error.message}`);

          try {
            await page.click(`#${id}`);
            await delay(100);

            const isChecked = await page.evaluate((checkboxId) => {
              const checkbox = document.getElementById(checkboxId);
              return checkbox ? checkbox.checked : false;
            }, id);

            if (isChecked) {
              console.log(
                `✅ Checkbox #${id} successfully checked (direct click).`
              );
            } else {
              throw new Error("Checkbox not checked after direct click");
            }
          } catch (error) {
            console.log(`❌ Failed to check checkbox #${id}: ${error.message}`);

            try {
              const jsResult = await page.evaluate((checkboxId) => {
                const checkbox = document.getElementById(checkboxId);
                if (!checkbox) return false;
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event("change", { bubbles: true }));
                return checkbox.checked;
              }, id);

              if (jsResult) {
                console.log(
                  `✅ Checkbox #${id} successfully checked (JavaScript).`
                );
              } else {
                console.log(`❌ All methods failed for checkbox #${id}.`);
              }
            } catch (jsError) {
              console.log(
                `❌ JavaScript method failed for #${id}: ${jsError.message}`
              );
            }
          }
        }
      }

      const finalCheckStatus = await page.evaluate((ids) => {
        const result = {};
        for (const id of ids) {
          const checkbox = document.getElementById(id);
          result[id] = checkbox ? checkbox.checked : false;
        }
        return result;
      }, checkboxIds);

      console.log("Final checkbox statuses:", finalCheckStatus);

      const allChecked = Object.values(finalCheckStatus).every(
        (status) => status === true
      );

      if (!allChecked) {
        console.warn(
          "⚠️ Warning: Some checkboxes could not be selected:",
          finalCheckStatus
        );
      } else {
        console.log("✅ All checkboxes successfully selected");
      }
    },
    setCheckAgreementBox: async (page, timeout = 2000) => {
      console.log(
        "🔍 Mencoba mencentang checkbox persetujuan 'saya-setuju'..."
      );

      try {
        const checkboxExists = await page.evaluate(() => {
          return !!document.getElementById("saya-setuju");
        });

        if (!checkboxExists) {
          console.error("❌ Checkbox persetujuan tidak ditemukan");
          return false;
        }

        const isAlreadyChecked = await page.evaluate(() => {
          const checkbox = document.getElementById("saya-setuju");
          return checkbox ? checkbox.checked : false;
        });

        if (isAlreadyChecked) {
          console.log("✅ Checkbox persetujuan sudah tercentang");
          return true;
        }

        try {
          await page.click('label[for="saya-setuju"]');
          await moduleExport.helpers.delay(200);

          const isCheckedAfterLabelClick = await page.evaluate(() => {
            const checkbox = document.getElementById("saya-setuju");
            return checkbox ? checkbox.checked : false;
          });

          if (isCheckedAfterLabelClick) {
            console.log(
              "✅ Checkbox persetujuan berhasil dicentang (via label)"
            );
            return true;
          }
        } catch (labelError) {
          console.log("⚠️ Klik pada label gagal:", labelError.message);
        }

        try {
          await page.click("#saya-setuju");
          await moduleExport.helpers.delay(200);

          const isCheckedAfterDirectClick = await page.evaluate(() => {
            const checkbox = document.getElementById("saya-setuju");
            return checkbox ? checkbox.checked : false;
          });

          if (isCheckedAfterDirectClick) {
            console.log(
              "✅ Checkbox persetujuan berhasil dicentang (via direct click)"
            );
            return true;
          }
        } catch (clickError) {
          console.log(
            "⚠️ Klik langsung pada checkbox gagal:",
            clickError.message
          );
        }

        const jsResult = await page.evaluate(() => {
          try {
            const checkbox = document.getElementById("saya-setuju");
            if (!checkbox) return false;

            checkbox.checked = true;

            checkbox.dispatchEvent(new Event("change", { bubbles: true }));
            checkbox.dispatchEvent(new Event("click", { bubbles: true }));

            const span = document.querySelector(".custom-form__check-span");
            if (span) {
              span.classList.add("checked");
            }

            return checkbox.checked;
          } catch (e) {
            console.error("JS Error:", e);
            return false;
          }
        });

        if (jsResult) {
          console.log(
            "✅ Checkbox persetujuan berhasil dicentang (via JavaScript)"
          );
          return true;
        }

        console.error(
          "❌ Semua metode gagal untuk mencentang checkbox persetujuan"
        );
        return false;
      } catch (error) {
        console.error(
          `❌ Error saat mencoba mencentang persetujuan: ${error.message}`
        );
        return false;
      }
    },
    setDateInput: async (
      page,
      dateValue,
      inputId = "tanggal_lahir",
      timeout = 5000
    ) => {
      console.log(
        `🔍 Mencoba mengisi input tanggal #${inputId} dengan nilai "${dateValue}"...`
      );

      try {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
          console.error(
            "❌ Format tanggal tidak valid, gunakan format dd/mm/yyyy"
          );
          return false;
        }

        const inputExists = await page.evaluate((id) => {
          return !!document.getElementById(id);
        }, inputId);

        if (!inputExists) {
          console.error(
            `❌ Input tanggal dengan ID #${inputId} tidak ditemukan`
          );
          return false;
        }

        let inputSuccess = false;
        try {
          await page.click(`#${inputId}`);
          await moduleExport.helpers.delay(300);

          await page.evaluate((id) => {
            const input = document.getElementById(id);
            input.value = "";
          }, inputId);

          await page.type(`#${inputId}`, dateValue, { delay: 100 });
          await moduleExport.helpers.delay(300);

          await page.keyboard.press("Tab");
          await moduleExport.helpers.delay(500);

          const inputValue = await page.evaluate((id) => {
            return document.getElementById(id).value;
          }, inputId);

          if (inputValue === dateValue) {
            console.log(
              `✅ Berhasil mengisi tanggal "${dateValue}" dengan input langsung`
            );
            inputSuccess = true;
          } else {
            console.log(
              `⚠️ Input langsung tidak berhasil, nilai terisi: "${inputValue}"`
            );
          }
        } catch (inputError) {
          console.log(`⚠️ Error pada input langsung: ${inputError.message}`);
        }

        if (inputSuccess) return true;

        console.log(`🔍 Mencoba menggunakan datepicker UI...`);

        const [day, month, year] = dateValue.split("/").map(Number);

        try {
          await page.click(`#${inputId}`);
          await moduleExport.helpers.delay(500);

          const datepickerVisible = await page.evaluate(() => {
            return !!document.querySelector(".datepicker.datepicker-dropdown");
          });

          if (!datepickerVisible) {
            console.log("⚠️ Datepicker tidak terbuka, mencoba lagi...");
            await page.click('.input-group-text img[alt="calendar icon"]');
            await moduleExport.helpers.delay(500);
          }

          await this.navigateToMonthYear(page, month, year);

          const daySelected = await this.selectDay(page, day);

          if (daySelected) {
            await moduleExport.helpers.delay(500);
            const finalValue = await page.evaluate((id) => {
              return document.getElementById(id).value;
            }, inputId);

            console.log(`✅ Nilai akhir input tanggal: "${finalValue}"`);
            return true;
          }

          console.log("🔍 Mencoba mengisi dengan JavaScript langsung...");

          const jsResult = await page.evaluate(
            (id, value) => {
              try {
                const input = document.getElementById(id);
                if (!input) return false;

                // Set value langsung
                input.value = value;

                // Trigger events
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));

                return input.value === value;
              } catch (e) {
                console.error(e);
                return false;
              }
            },
            inputId,
            dateValue
          );

          if (jsResult) {
            console.log(
              `✅ Berhasil mengisi tanggal "${dateValue}" dengan JavaScript`
            );
            return true;
          }

          console.error(
            `❌ Semua metode gagal untuk mengisi tanggal "${dateValue}"`
          );
          return false;
        } catch (error) {
          console.error(`❌ Error saat mengisi tanggal: ${error.message}`);
          return false;
        }
      } catch (generalError) {
        console.error(`❌ Error umum: ${generalError.message}`);
        return false;
      }
    },
    setUploadLocalProfilePhoto: async (page, imageName) => {
      try {
        const inputUploadHandle = await page.$("input#avatarInput");
        const imagePath = path.join(__dirname, "..", "images", imageName);
        await inputUploadHandle.uploadFile(imagePath);

        console.log("Profile photo upload initiated from path:", imagePath);

        console.log("Waiting for confirmation popup to appear...");
        await page.waitForSelector(".modal-alert.show", {
          visible: true,
          timeout: 5000,
        });
        console.log("Warning popup detected");

        await moduleExport.helpers.delay(500);

        await page.click('.themeBtn[data-bs-dismiss="modal"]');
        console.log("Clicked 'Baik, Saya mengerti' button");

        await page.waitForSelector(".modal-alert.show", {
          hidden: true,
          timeout: 3000,
        });
        console.log("Warning popup closed successfully");

        await moduleExport.helpers.delay(1000);

        console.log("Profile photo upload process completed successfully");
        return true;
      } catch (error) {
        console.error("Error during profile photo upload process:", error);
        console.error("Error details:", error.message);
        return false;
      }
    },
    navigateToMonthYear: async (page, month, year) => {
      try {
        await page.click(".datepicker-controls .view-switch");
        await moduleExport.helpers.delay(300);

        const viewMode = await page.evaluate(() => {
          if (document.querySelector(".datepicker-view .months"))
            return "months";
          if (document.querySelector(".datepicker-view .years")) return "years";
          return "days";
        });

        if (viewMode === "months") {
          await page.click(".datepicker-controls .view-switch");
          await moduleExport.helpers.delay(300);
        }

        const currentYearRange = await page.evaluate(() => {
          const viewSwitch = document.querySelector(".view-switch");
          return viewSwitch ? viewSwitch.textContent.trim() : "";
        });

        let startYear, endYear;
        if (currentYearRange.includes("-")) {
          [startYear, endYear] = currentYearRange
            .split("-")
            .map((y) => parseInt(y.trim()));
        }

        if (startYear && endYear) {
          while (year < startYear) {
            const prevEnabled = await page.evaluate(() => {
              const prevBtn = document.querySelector(
                ".datepicker-controls .prev-btn"
              );
              return !prevBtn.disabled;
            });

            if (prevEnabled) {
              await page.click(".datepicker-controls .prev-btn");
              await moduleExport.helpers.delay(200);

              const newRange = await page.evaluate(() => {
                const viewSwitch = document.querySelector(".view-switch");
                return viewSwitch ? viewSwitch.textContent.trim() : "";
              });

              if (newRange.includes("-")) {
                [startYear, endYear] = newRange
                  .split("-")
                  .map((y) => parseInt(y.trim()));
              }
            } else {
              console.log(
                "⚠️ Tombol prev nonaktif, tidak bisa navigasi lebih jauh"
              );
              break;
            }
          }

          while (year > endYear) {
            const nextEnabled = await page.evaluate(() => {
              const nextBtn = document.querySelector(
                ".datepicker-controls .next-btn"
              );
              return !nextBtn.disabled;
            });

            if (nextEnabled) {
              await page.click(".datepicker-controls .next-btn");
              await moduleExport.helpers.delay(200);

              const newRange = await page.evaluate(() => {
                const viewSwitch = document.querySelector(".view-switch");
                return viewSwitch ? viewSwitch.textContent.trim() : "";
              });

              if (newRange.includes("-")) {
                [startYear, endYear] = newRange
                  .split("-")
                  .map((y) => parseInt(y.trim()));
              }
            } else {
              console.log(
                "⚠️ Tombol next nonaktif, tidak bisa navigasi lebih jauh"
              );
              break;
            }
          }
        }

        await page.evaluate((targetYear) => {
          const yearCells = document.querySelectorAll(".datepicker-view .year");
          for (const cell of yearCells) {
            if (cell.textContent.trim() === String(targetYear)) {
              cell.click();
              return;
            }
          }
        }, year);
        await moduleExport.helpers.delay(300);

        await page.evaluate((targetMonth) => {
          const monthIndex = targetMonth - 1;
          const monthCells = document.querySelectorAll(
            ".datepicker-view .month"
          );
          if (monthCells && monthCells[monthIndex]) {
            monthCells[monthIndex].click();
          }
        }, month);
        await moduleExport.helpers.delay(300);

        return true;
      } catch (error) {
        console.error(`❌ Error saat navigasi bulan/tahun: ${error.message}`);
        return false;
      }
    },
    selectDay: async (page, day) => {
      try {
        const daySelected = await page.evaluate((targetDay) => {
          const dayCells = document.querySelectorAll(
            ".datepicker-view .datepicker-cell.day:not(.prev):not(.next):not(.disabled)"
          );

          for (const cell of dayCells) {
            if (cell.textContent.trim() === String(targetDay)) {
              cell.click();
              return true;
            }
          }
          return false;
        }, day);

        if (daySelected) {
          console.log(`✅ Berhasil memilih tanggal ${day}`);
          return true;
        } else {
          console.log(`⚠️ Tidak dapat menemukan atau mengklik tanggal ${day}`);
          return false;
        }
      } catch (error) {
        console.error(`❌ Error saat memilih hari: ${error.message}`);
        return false;
      }
    },
  },
};

module.exports = moduleExport;
