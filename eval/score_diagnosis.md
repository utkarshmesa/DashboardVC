# Score diagnosis

Generated 2026-10-11T21:32:16.613Z from the live database (accepted signals only; same scoring code as the pipeline).
Formula (SPEC §9.5): value = TYPE × SUBJECT × relevance × 0.5^(age / 20); score = round(100 × (top + 0.25 × other groups)), capped at 100.
TYPE = {"investment":1,"authored":0.8,"speaking":0.7,"press":0.5,"other":0.3}; SUBJECT = {"person":1,"firm":0.7}; undated date_approx items are aged 30 days.

## Accepted, in-window signals (110 of 110 accepted)

- By type: speaking: 33 · other: 29 · press: 29 · authored: 11 · investment: 8
- By subject: person: 86 · firm: 24
- By date_approx: dated: 66 · date_approx: 44
- By source: tavily: 93 · google_news: 9 · firm_rss: 8
- Relevance buckets: <0.2: 99 · 0.2–0.4: 9 · ≥0.6: 2 (median 0.10, 90th percentile 0.20, max 0.60)
- Signals meeting the evidence floor (investment/authored/speaking, relevance ≥ 0.6): 0

## Per VC (top signal)

| VC | Firm | Score | Top type | Subject | Relevance | Age (days) | date_approx | Event groups | Current action |
|---|---|---|---|---|---|---|---|---|---|
| Prajakt Raut | Caret Capital | 13 | speaking | person | 0.20 | 1.2 | no | 1 | Low — activity outside your space |
| Poorvi Vijay | Elevation Capital | 12 | speaking | person | 0.20 | 4.9 | no | 2 | Low — activity outside your space |
| Shailesh Ghorpade | Exfinity Venture Partners | 11 | press | person | 0.60 | 30.0 | yes | 1 | Low — weak or fading signal |
| Kushal Bhagia | All In Capital | 11 | speaking | person | 0.15 | 2.4 | no | 2 | Low — activity outside your space |
| Hemant Mohapatra | Lightspeed | 10 | press | person | 0.20 | 0.6 | no | 1 | Low — activity outside your space |
| Anurag Ramdasan | 3one4 Capital | 10 | authored | person | 0.20 | 12.4 | no | 2 | Low — activity outside your space |
| Amit Somani | Prime Venture Partners | 9 | authored | person | 0.15 | 20.9 | no | 5 | Low — activity outside your space |
| Brij Bhushan | Prime Venture Partners | 8 | authored | person | 0.20 | 20.9 | no | 1 | Low — activity outside your space |
| Sunil Goyal | YourNest | 7 | other | person | 0.30 | 8.8 | no | 2 | Low — activity outside your space |
| Rishabh Katiyar | Info Edge Ventures | 7 | press | person | 0.15 | 4.4 | no | 2 | Low — activity outside your space |
| Rajiv Raghunandan | Arali Ventures | 7 | speaking | person | 0.15 | 9.9 | no | 1 | Low — activity outside your space |
| Avijeet Alagathi | Shastra VC | 6 | other | person | 0.20 | 0.6 | no | 1 | Low — activity outside your space |
| Gowri Shankar | Antler India | 6 | investment | firm | 0.10 | 12.6 | no | 4 | Low — activity outside your space |
| Arjun Rao | Speciale Invest | 6 | authored | person | 0.15 | 30.0 | yes | 3 | Low — activity outside your space |
| Nitin Sharma | Antler India | 6 | investment | firm | 0.10 | 12.6 | no | 6 | Low — activity outside your space |
| Madhukar Sinha | India Quotient | 5 | speaking | person | 0.10 | 19.3 | no | 4 | Low — activity outside your space |
| Prayank Swaroop | Accel | 5 | investment | firm | 0.10 | 12.6 | no | 1 | Low — activity outside your space |
| Vinod Shankar | Java Capital | 5 | authored | person | 0.10 | 16.4 | no | 2 | Low — activity outside your space |
| Raiyaan Shingati | Transition VC | 5 | speaking | person | 0.15 | 30.0 | yes | 3 | Low — activity outside your space |
| Shubham Jhuria | Aeravti Ventures | 4 | speaking | person | 0.15 | 30.0 | yes | 1 | Low — activity outside your space |
| Shiva Shanker | Ankur Capital | 4 | speaking | person | 0.15 | 30.0 | yes | 2 | Low — activity outside your space |
| Sanjay Nath | Blume Ventures | 3 | other | person | 0.10 | 5.0 | no | 3 | Low — activity outside your space |
| Ashis Nayak | Shastra VC | 3 | speaking | person | 0.10 | 30.0 | yes | 2 | Low — activity outside your space |
| Mitesh Shah | Inflection Point Ventures | 3 | speaking | person | 0.10 | 30.0 | yes | 2 | Low — activity outside your space |
| Ganapathy Venugopal | Axilor Ventures | 3 | speaking | person | 0.10 | 30.0 | yes | 3 | Low — activity outside your space |
| Sateesh Andra | Endiya Partners | 3 | press | person | 0.10 | 21.6 | no | 2 | Low — activity outside your space |
| Nishit Garg | RTP Global | 3 | authored | person | 0.10 | 30.0 | yes | 3 | Low — activity outside your space |
| Anand Lunia | India Quotient | 3 | speaking | person | 0.10 | 30.0 | yes | 3 | Low — activity outside your space |
| Dev Khare | Lightspeed | 3 | press | person | 0.15 | 30.0 | yes | 3 | Low — activity outside your space |
| Anand Datta | Nexus Venture Partners | 2 | speaking | person | 0.10 | 30.0 | yes | 1 | Low — activity outside your space |
| Kunal Bahl | Titan Capital | 2 | press | person | 0.05 | 17.8 | no | 2 | Low — activity outside your space |
| Alok Goyal | Stellaris Venture Partners | 2 | press | firm | 0.10 | 16.6 | no | 6 | Low — activity outside your space |
| Gireendra Kasmalkar | Pentathlon Ventures | 2 | press | person | 0.10 | 30.0 | yes | 1 | Low — activity outside your space |
| Harsh Deodhar | Enrission India Capital | 2 | speaking | person | 0.10 | 30.0 | yes | 1 | Low — activity outside your space |
| Venkatesh Peddi | Chiratae Ventures | 0 | investment | firm | 0.00 | 4.6 | no | 1 | Quiet — hold |
| Ali Shariff | Mount Judi Ventures | 0 | — | — | — | — | — | — | Quiet — hold |
| Rajinder Balaraman | Z47 | 0 | — | — | — | — | — | — | Quiet — hold |
| Krishnan Neelakantan | Ankur Capital | 0 | — | — | — | — | — | — | Quiet — hold |
| Vishesh Rajaram | Speciale Invest | 0 | — | — | — | — | — | — | Quiet — hold |
| Rohit Bansal | Titan Capital | 0 | — | — | — | — | — | — | Quiet — hold |
| Prachi Sinha | Axilor Ventures | 0 | — | — | — | — | — | — | Quiet — hold |
| Madhukar Bhatia | Pentathlon Ventures | 0 | — | — | — | — | — | — | Quiet — hold |
| Arun Raghavan | Arali Ventures | 0 | other | person | 0.00 | 5.2 | no | 1 | Quiet — hold |
| Shekhar Kirani | Accel | 0 | speaking | person | 0.00 | 11.2 | no | 4 | Quiet — hold |
| Madhav Tandan | Orios Venture Partners | 0 | — | — | — | — | — | — | Quiet — hold |
| Mark Kahn | Omnivore | 0 | speaking | person | 0.00 | 30.0 | yes | 1 | Quiet — hold |
| Pranav Pai | 3one4 Capital | 0 | — | — | — | — | — | — | Quiet — hold |
| Manav Garg | Together Fund | 0 | — | — | — | — | — | — | Quiet — hold |
| Aditya Singh | All In Capital | 0 | — | — | — | — | — | — | Quiet — hold |
| Girish Shivani | YourNest | 0 | — | — | — | — | — | — | Quiet — hold |
