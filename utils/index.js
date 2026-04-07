const path = require("path");

const moduleExport = {
  helpers: {
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
  common: {
    waitForCloudflare: async (page, timeout = 300000) => {
      const pollInterval = 1000;
      const logInterval = 5000;
      const startTime = Date.now();
      let lastLogTime = 0;
      let detected = false;

      while (Date.now() - startTime < timeout) {
        const blockingInfo = await page
          .evaluate(() => {
            const title = document.title.toLowerCase();
            const cfTitle =
              title.includes("just a moment") ||
              title.includes("checking your browser") ||
              title.includes("attention required") ||
              title.includes("cloudflare");

            const cfElement =
              !!document.getElementById("challenge-form") ||
              !!document.getElementById("cf-challenge-running") ||
              !!document.getElementById("challenge-running") ||
              !!document.querySelector(".cf-browser-verification") ||
              !!document.querySelector("[data-cf-settings]") ||
              !!document.querySelector("meta[name='cf-bypass-status']");

            const queueElement =
              !!document.getElementById("waitTime") ||
              !!document.getElementById("last-updated");

            const isBlocking = cfTitle || cfElement || queueElement;

            let type = null;
            if (cfTitle || cfElement) type = "cloudflare";
            else if (queueElement) type = "queue";

            return { isBlocking, type };
          })
          .catch(() => ({ isBlocking: false, type: null }));

        if (!blockingInfo.isBlocking) {
          if (detected) {
            console.log("✅ Halaman blocking selesai, melanjutkan proses...");
          }
          return true;
        }

        detected = true;
        const now = Date.now();
        if (now - lastLogTime >= logInterval) {
          const elapsed = Math.round((now - startTime) / 1000);
          const label =
            blockingInfo.type === "queue"
              ? "antrian virtual"
              : "Cloudflare challenge";
          console.log(`⏳ Menunggu ${label} selesai... (${elapsed}s berlalu)`);
          lastLogTime = now;
        }

        await moduleExport.helpers.delay(pollInterval);
      }

      console.warn(
        "⚠️ Timeout menunggu halaman blocking. Melanjutkan proses meski belum pasti selesai...",
      );
      return false;
    },
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
        checkboxIds,
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
                `✅ Last checkbox #${lastId} checked (exclusive mode)`,
              );
            } catch (clickError) {
              await page.evaluate((id) => {
                const checkbox = document.getElementById(id);
                if (checkbox) {
                  checkbox.checked = true;
                  checkbox.dispatchEvent(
                    new Event("change", { bubbles: true }),
                  );
                }
              }, lastId);
              console.log(
                `✅ Last checkbox #${lastId} checked via JavaScript (exclusive mode)`,
              );
            }
          } else {
            console.log(
              `✅ Last checkbox #${lastId} already checked (exclusive mode)`,
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
              `🔒 Checkbox #${id} disabled and unchecked (exclusive mode)`,
            );
          }
        } catch (error) {
          console.log(
            `❌ Failed to process exclusive checkbox group: ${error.message}`,
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
              `✅ Checkbox #${id} successfully checked (label click).`,
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
                `✅ Checkbox #${id} successfully checked (direct click).`,
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
                  `✅ Checkbox #${id} successfully checked (JavaScript).`,
                );
              } else {
                console.log(`❌ All methods failed for checkbox #${id}.`);
              }
            } catch (jsError) {
              console.log(
                `❌ JavaScript method failed for #${id}: ${jsError.message}`,
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
        (status) => status === true,
      );

      if (!allChecked) {
        console.warn(
          "⚠️ Warning: Some checkboxes could not be selected:",
          finalCheckStatus,
        );
      } else {
        console.log("✅ All checkboxes successfully selected");
      }
    },
    setCheckAgreementBox: async (page, timeout = 2000) => {
      console.log(
        "🔍 Mencoba mencentang checkbox persetujuan 'saya-setuju'...",
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
              "✅ Checkbox persetujuan berhasil dicentang (via label)",
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
              "✅ Checkbox persetujuan berhasil dicentang (via direct click)",
            );
            return true;
          }
        } catch (clickError) {
          console.log(
            "⚠️ Klik langsung pada checkbox gagal:",
            clickError.message,
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
            "✅ Checkbox persetujuan berhasil dicentang (via JavaScript)",
          );
          return true;
        }

        console.error(
          "❌ Semua metode gagal untuk mencentang checkbox persetujuan",
        );
        return false;
      } catch (error) {
        console.error(
          `❌ Error saat mencoba mencentang persetujuan: ${error.message}`,
        );
        return false;
      }
    },
    setDateInput: async (
      page,
      dateValue,
      inputId = "tanggal_lahir",
      timeout = 5000,
    ) => {
      console.log(
        `🔍 Mencoba mengisi input tanggal #${inputId} dengan nilai "${dateValue}"...`,
      );

      try {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
          console.error(
            "❌ Format tanggal tidak valid, gunakan format dd/mm/yyyy",
          );
          return false;
        }

        const inputExists = await page.evaluate((id) => {
          return !!document.getElementById(id);
        }, inputId);

        if (!inputExists) {
          console.error(
            `❌ Input tanggal dengan ID #${inputId} tidak ditemukan`,
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
              `✅ Berhasil mengisi tanggal "${dateValue}" dengan input langsung`,
            );
            inputSuccess = true;
          } else {
            console.log(
              `⚠️ Input langsung tidak berhasil, nilai terisi: "${inputValue}"`,
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

                input.value = value;

                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));

                return input.value === value;
              } catch (e) {
                console.error(e);
                return false;
              }
            },
            inputId,
            dateValue,
          );

          if (jsResult) {
            console.log(
              `✅ Berhasil mengisi tanggal "${dateValue}" dengan JavaScript`,
            );
            return true;
          }

          console.error(
            `❌ Semua metode gagal untuk mengisi tanggal "${dateValue}"`,
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
    setChoicesSelectByValue: async (page, selectId, value) => {
      const strValue = String(value);
      console.log(
        `🔍 Memilih opsi pada select #${selectId} dengan value "${strValue}"...`,
      );

      try {
        const selectExists = await page.evaluate(
          (id) => !!document.getElementById(id),
          selectId,
        );
        if (!selectExists) {
          console.error(`❌ Select #${selectId} tidak ditemukan`);
          return false;
        }

        const currentValue = await page.evaluate(
          (id) => document.getElementById(id)?.value ?? null,
          selectId,
        );
        if (currentValue === strValue) {
          console.log(
            `✅ Select #${selectId} sudah memiliki value "${strValue}", skip`,
          );
          return true;
        }

        const innerHandle = await page.evaluateHandle((id) => {
          return (
            document
              .getElementById(id)
              ?.closest(".choices")
              ?.querySelector(".choices__inner") ?? null
          );
        }, selectId);

        const innerEl = innerHandle.asElement();
        if (!innerEl) {
          console.error(
            `❌ .choices__inner tidak ditemukan untuk #${selectId}`,
          );
          return false;
        }
        await innerEl.click();

        try {
          await page.waitForFunction(
            (id) => {
              const wrapper = document.getElementById(id)?.closest(".choices");
              const dropdown = wrapper?.querySelector(
                ".choices__list--dropdown",
              );
              return (
                wrapper?.classList.contains("is-open") &&
                dropdown?.classList.contains("is-active") &&
                dropdown?.getAttribute("aria-expanded") === "true"
              );
            },
            { timeout: 5000 },
            selectId,
          );
        } catch {
          console.warn(
            `⚠️ Dropdown #${selectId} belum terbuka dalam 5s, tetap lanjut...`,
          );
        }

        const searchHandle = await page.evaluateHandle((id) => {
          const wrapper = document.getElementById(id)?.closest(".choices");
          return (
            wrapper?.querySelector(
              ".choices__list--dropdown input.choices__input--cloned",
            ) ?? null
          );
        }, selectId);
        const searchEl = searchHandle.asElement();

        if (searchEl) {
          const targetText = await page.evaluate(
            (id, val) => {
              const wrapper = document.getElementById(id)?.closest(".choices");
              const listbox = wrapper?.querySelector(
                '.choices__list--dropdown .choices__list[role="listbox"]',
              );
              const item = listbox?.querySelector(
                `.choices__item[data-value="${val}"][data-choice-selectable]`,
              );
              return item?.textContent?.trim() ?? null;
            },
            selectId,
            strValue,
          );

          if (targetText) {
            const searchKeyword = targetText;
            await searchEl.type(searchKeyword, { delay: 30 });
            await moduleExport.helpers.delay(400);
            console.log(`🔎 Mengetik "${searchKeyword}" untuk memfilter opsi`);

            const itemStillVisible = await page.evaluate(
              (id, val) => {
                const wrapper = document
                  .getElementById(id)
                  ?.closest(".choices");
                const listbox = wrapper?.querySelector(
                  '.choices__list--dropdown .choices__list[role="listbox"]',
                );
                return !!listbox?.querySelector(
                  `.choices__item[data-value="${val}"][data-choice-selectable]`,
                );
              },
              selectId,
              strValue,
            );

            if (!itemStillVisible) {
              console.log(
                "⚠️ Item tidak ditemukan setelah filter, membersihkan search...",
              );
              await page.evaluate((id) => {
                const wrapper = document
                  .getElementById(id)
                  ?.closest(".choices");
                const input = wrapper?.querySelector(
                  "input.choices__input--cloned",
                );
                if (input) {
                  input.value = "";
                  input.dispatchEvent(new Event("input", { bubbles: true }));
                }
              }, selectId);
              await moduleExport.helpers.delay(300);
            }
          }
        }

        const itemHandle = await page.evaluateHandle(
          (id, val) => {
            const listbox = document
              .getElementById(id)
              ?.closest(".choices")
              ?.querySelector(
                ".choices__list--dropdown .choices__list[role='listbox']",
              );
            return (
              listbox?.querySelector(
                `.choices__item[data-value="${val}"][data-choice-selectable]`,
              ) ?? null
            );
          },
          selectId,
          strValue,
        );

        const itemEl = itemHandle.asElement();
        if (!itemEl) {
          console.warn(
            `⚠️ Item value="${strValue}" tidak ditemukan di dropdown #${selectId}`,
          );
          await page.keyboard.press("Escape");
          await moduleExport.helpers.delay(200);
        } else {
          await page.evaluate(
            (id, val) => {
              const listbox = document
                .getElementById(id)
                ?.closest(".choices")
                ?.querySelector(
                  '.choices__list--dropdown .choices__list[role="listbox"]',
                );
              const item = listbox?.querySelector(
                `.choices__item[data-value="${val}"][data-choice-selectable]`,
              );
              if (listbox && item) {
                listbox.scrollTop =
                  item.offsetTop -
                  listbox.clientHeight / 2 +
                  item.clientHeight / 2;
              }
            },
            selectId,
            strValue,
          );

          await moduleExport.helpers.delay(150);

          const box = await itemEl.boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await page.mouse.move(x, y, { steps: 5 });
            await moduleExport.helpers.delay(80);
            await page.mouse.down();
            await moduleExport.helpers.delay(60);
            await page.mouse.up();
          } else {
            await itemEl.evaluate((el) => el.click());
          }

          await moduleExport.helpers.delay(300);

          const afterValue = await page.evaluate(
            (id) => document.getElementById(id)?.value ?? null,
            selectId,
          );
          if (afterValue === strValue) {
            console.log(
              `✅ Select #${selectId} berhasil dipilih: "${strValue}"`,
            );
            return true;
          }
          console.warn(
            `⚠️ Item diklik tapi value belum sinkron (${afterValue} != ${strValue}), mencoba fallback...`,
          );
        }

        await page.evaluate(() => document.body.click());
        await moduleExport.helpers.delay(200);

        const directResult = await page.evaluate(
          (id, val) => {
            try {
              const select = document.getElementById(id);
              if (!select) return false;

              const wrapper = select.closest(".choices");
              if (!wrapper) return false;

              const listbox = wrapper.querySelector(
                '.choices__list--dropdown .choices__list[role="listbox"]',
              );
              const targetItem = listbox?.querySelector(
                `.choices__item[data-value="${val}"][data-choice-selectable]`,
              );

              if (!targetItem) return false;

              const itemText = targetItem.textContent.trim();

              let option = select.querySelector(`option[value="${val}"]`);
              if (!option) {
                select.innerHTML = `<option value="${val}" data-custom-properties="[object Object]">${itemText}</option>`;
              }

              const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLSelectElement.prototype,
                "value",
              )?.set;
              if (nativeSetter) nativeSetter.call(select, val);
              else select.value = val;

              const singleList = wrapper.querySelector(
                ".choices__list--single",
              );
              if (singleList) {
                const existingItem = singleList.querySelector(".choices__item");
                if (existingItem) {
                  existingItem.textContent = itemText;
                  existingItem.dataset.value = val;
                  existingItem.classList.remove("choices__placeholder");
                  existingItem.setAttribute("aria-selected", "true");
                }
              }

              listbox
                ?.querySelectorAll(".choices__item.is-selected")
                .forEach((el) => {
                  el.classList.remove("is-selected", "is-highlighted");
                  el.removeAttribute("aria-selected");
                });
              targetItem.classList.add("is-selected");
              targetItem.setAttribute("aria-selected", "true");

              select.dispatchEvent(new Event("change", { bubbles: true }));

              return select.value === val;
            } catch {
              return false;
            }
          },
          selectId,
          strValue,
        );

        if (directResult) {
          console.log(
            `✅ Select #${selectId} berhasil via direct DOM fallback: "${strValue}"`,
          );
          return true;
        }

        console.error(`❌ Semua metode gagal untuk select #${selectId}`);
        return false;
      } catch (error) {
        console.error(
          `❌ Error pada setChoicesSelectByValue #${selectId}: ${error.message}`,
        );
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
                ".datepicker-controls .prev-btn",
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
                "⚠️ Tombol prev nonaktif, tidak bisa navigasi lebih jauh",
              );
              break;
            }
          }

          while (year > endYear) {
            const nextEnabled = await page.evaluate(() => {
              const nextBtn = document.querySelector(
                ".datepicker-controls .next-btn",
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
                "⚠️ Tombol next nonaktif, tidak bisa navigasi lebih jauh",
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
            ".datepicker-view .month",
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
            ".datepicker-view .datepicker-cell.day:not(.prev):not(.next):not(.disabled)",
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
