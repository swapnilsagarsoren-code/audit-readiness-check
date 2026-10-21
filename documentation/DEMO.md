# Demo walkthrough

This page walks the three flows in about three minutes. Every figure below comes from the synthetic books. You need the app running against a seeded dev deployment with the edit passcode set. See the [README](../README.md).

## The list

Open the app. The header reads "Overall materiality ₹45 lakh · Flag line ₹22.5 lakh". Seven gaps show.

| Gap | Size | Band |
| --- | --- | --- |
| Meridian Co-operative Bank, term loan | ₹9,60,00,000 | Flagged |
| Rajesh Mehta | ₹2,50,00,000 | Flagged |
| Anita Mehta | ₹60,00,000 | Flagged |
| Mehta Family Trust | ₹50,00,000 | Flagged |
| Sharma Traders | ₹10,00,000 | Below flag line |
| Delta Rubber | ₹8,00,000 | Below flag line |
| Bharat Fasteners | ₹5,60,000 | Below flag line |

A supplier with ₹1,90,000 of late bills is under 5% of overall materiality and stays hidden.

## Flow 1: Rajesh Mehta (R1)

1. Open **Rajesh Mehta**. The screen shows three bank receipts, labelled "temporary funds from MD". The question asks what the money was for and does not say "loan".
2. Press **Loan**, then **Director**, **Within 12 months**, and **No** for the written declaration.
3. Type the edit passcode and press **Save answer**.
4. The outcome reads "Move from trade payables to borrowings", with a related-party note and "Legal review needed" because the declaration is not held. The proposed entry debits Rajesh Mehta and credits short-term related-party borrowings, ₹2,50,00,000.
5. The ratio block shows debt-equity moving from 1.40 to 1.57. The covenant limit is 1.50, so the move breaks it.
6. Press **Approve**. The line under the buttons says nothing is written to the books.

## Flow 2: Delta Rubber (R2)

1. Open **Delta Rubber**. The bill dated 1 June 2025 was paid on 1 July 2025, 30 days after the bill date, 15 days later than the 15 allowed.
2. Press **Yes, on file**, **Small**, and **None in writing**. Save.
3. The outcome shows one late bill with 15 days late and indicative interest of ₹5,671.23. That is ₹8,00,000 at three times the RBI Bank Rate for 15 days, if the stored Bank Rate is 5.75%, the rate listed when the data was prepared. If your stored rate differs, so does the figure. The note says the rate comes from the RBI site on the stored date and is indicative.
4. Press **Approve**. Without a stored Bank Rate, the interest reads "Not priced yet" and Approve is not offered.

## Flow 3: Meridian Co-operative Bank (R3)

1. Open **Meridian Co-operative Bank**. The loan has 60 monthly instalments and 12 are paid at ₹20,00,000 each. The closing balance is ₹9,60,00,000.
2. Press **Both on file**. Save.
3. The outcome shows ₹2,40,00,000 due within 12 months and the proposed entry into "Current maturities of long-term borrowings".
4. The ratio block shows the current ratio moving from 1.23 to 1.14. The covenant floor is 1.20, so it drops below.
5. Press **Approve**. With only a sanction letter, or neither document, the split is an estimate and only **Send back** is offered.

## If something goes wrong

- A screen reads "Couldn't load". Press **Try again**. If it stays, the deployment is missing the latest functions, so run `npx convex dev --once`.
- "That passcode is wrong." Ten wrong tries in one India hour lock all edits until the next hour.
- Interest reads "Not priced yet". Run `node --import tsx scripts/fetch-rbi-rate.mts` to store the Bank Rate.
- **Approve** is greyed out. You changed a button after saving, so press **Save answer** again.
