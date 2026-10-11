# Score diagnosis

Generated 2026-10-11T21:44:51.830Z from the live database (accepted signals only; same scoring code as the pipeline).
Formula (SPEC §9.5): value = TYPE × SUBJECT × relevance × 0.5^(age / 20); score = round(100 × (top + 0.25 × other groups)), capped at 100.
TYPE = {"investment":1,"authored":0.8,"speaking":0.7,"press":0.5,"other":0.3}; SUBJECT = {"person":1,"firm":0.7}; undated date_approx items are aged 30 days.

## Accepted, in-window signals (113 of 113 accepted)

- By type: speaking: 36 · other: 29 · press: 27 · authored: 12 · investment: 9
- By subject: person: 87 · firm: 26
- By date_approx: dated: 69 · date_approx: 44
- By source: tavily: 96 · google_news: 9 · firm_rss: 8
- By relevance_level: unrelated: 75 · adjacent: 36 · core: 2
- Relevance buckets: <0.4: 75 · 0.4–0.6: 36 · ≥0.6: 2 (median 0.10, 90th percentile 0.40, max 1.00)
- Signals meeting the evidence floor (investment/authored/speaking, relevance ≥ 0.6): 0

## Per VC (top signal)

| VC | Firm | Score | Top type | Subject | Level | Relevance | Age (days) | date_approx | Event groups | Current action |
|---|---|---|---|---|---|---|---|---|---|---|
| Poorvi Vijay | Elevation Capital | 26 | speaking | person | adjacent | 0.40 | 4.9 | no | 2 | Warm — reach out if capacity |
| Venkatesh Peddi | Chiratae Ventures | 24 | investment | firm | adjacent | 0.40 | 4.6 | no | 1 | Low — weak or fading signal |
| Anurag Ramdasan | 3one4 Capital | 22 | authored | person | adjacent | 0.40 | 12.4 | no | 3 | Low — weak or fading signal |
| Hemant Mohapatra | Lightspeed | 20 | press | person | adjacent | 0.40 | 0.6 | no | 1 | Low — weak or fading signal |
| Amit Somani | Prime Venture Partners | 18 | authored | person | adjacent | 0.40 | 20.9 | no | 5 | Low — weak or fading signal |
| Vinod Shankar | Java Capital | 18 | speaking | person | adjacent | 0.40 | 16.4 | no | 2 | Low — weak or fading signal |
| Prayank Swaroop | Accel | 18 | investment | firm | adjacent | 0.40 | 12.6 | no | 1 | Low — weak or fading signal |
| Shailesh Ghorpade | Exfinity Venture Partners | 18 | press | person | core | 1.00 | 30.0 | yes | 1 | Low — weak or fading signal |
| Rishabh Katiyar | Info Edge Ventures | 17 | press | person | adjacent | 0.40 | 4.4 | no | 1 | Low — weak or fading signal |
| Kushal Bhagia | All In Capital | 16 | press | person | adjacent | 0.40 | 13.3 | no | 3 | Low — weak or fading signal |
| Arjun Rao | Speciale Invest | 14 | authored | person | adjacent | 0.40 | 30.0 | yes | 3 | Low — weak or fading signal |
| Nitin Sharma | Antler India | 14 | investment | person | unrelated | 0.10 | 4.1 | no | 6 | Low — activity outside your space |
| Dev Khare | Lightspeed | 12 | speaking | person | adjacent | 0.40 | 30.0 | yes | 3 | Low — weak or fading signal |
| Sateesh Andra | Endiya Partners | 12 | press | person | adjacent | 0.40 | 21.6 | no | 2 | Low — weak or fading signal |
| Nishit Garg | RTP Global | 12 | press | person | adjacent | 0.40 | 15.9 | no | 3 | Low — weak or fading signal |
| Anand Lunia | India Quotient | 11 | speaking | person | adjacent | 0.40 | 30.0 | yes | 3 | Low — weak or fading signal |
| Madhukar Sinha | India Quotient | 11 | investment | firm | unrelated | 0.10 | 3.4 | no | 5 | Low — activity outside your space |
| Ganapathy Venugopal | Axilor Ventures | 11 | speaking | person | adjacent | 0.40 | 30.0 | yes | 3 | Low — weak or fading signal |
| Anand Datta | Nexus Venture Partners | 10 | speaking | person | adjacent | 0.40 | 30.0 | yes | 1 | Low — weak or fading signal |
| Gowri Shankar | Antler India | 10 | other | firm | adjacent | 0.40 | 2.3 | no | 4 | Low — weak or fading signal |
| Shekhar Kirani | Accel | 9 | press | person | adjacent | 0.40 | 30.0 | yes | 4 | Low — weak or fading signal |
| Alok Goyal | Stellaris Venture Partners | 9 | investment | firm | unrelated | 0.10 | 3.4 | no | 6 | Low — activity outside your space |
| Avijeet Alagathi | Shastra VC | 8 | other | firm | adjacent | 0.40 | 0.6 | no | 1 | Low — weak or fading signal |
| Sunil Goyal | YourNest | 7 | other | firm | adjacent | 0.40 | 8.8 | no | 2 | Low — weak or fading signal |
| Gireendra Kasmalkar | Pentathlon Ventures | 7 | press | person | adjacent | 0.40 | 30.0 | yes | 1 | Low — weak or fading signal |
| Kunal Bahl | Titan Capital | 5 | authored | person | unrelated | 0.10 | 17.8 | no | 2 | Low — activity outside your space |
| Rajiv Raghunandan | Arali Ventures | 5 | speaking | person | unrelated | 0.10 | 9.9 | no | 1 | Low — activity outside your space |
| Brij Bhushan | Prime Venture Partners | 4 | authored | person | unrelated | 0.10 | 20.9 | no | 1 | Low — activity outside your space |
| Raiyaan Shingati | Transition VC | 3 | speaking | person | unrelated | 0.10 | 30.0 | yes | 3 | Low — activity outside your space |
| Arun Raghavan | Arali Ventures | 3 | other | person | unrelated | 0.10 | 5.2 | no | 1 | Low — activity outside your space |
| Ashis Nayak | Shastra VC | 3 | speaking | person | unrelated | 0.10 | 30.0 | yes | 2 | Low — activity outside your space |
| Mitesh Shah | Inflection Point Ventures | 3 | speaking | person | unrelated | 0.10 | 30.0 | yes | 2 | Low — activity outside your space |
| Sanjay Nath | Blume Ventures | 3 | other | person | unrelated | 0.10 | 5.0 | no | 3 | Low — activity outside your space |
| Shiva Shanker | Ankur Capital | 3 | speaking | person | unrelated | 0.10 | 30.0 | yes | 2 | Low — activity outside your space |
| Prajakt Raut | Caret Capital | 3 | other | person | unrelated | 0.10 | 1.2 | no | 1 | Low — activity outside your space |
| Shubham Jhuria | Aeravti Ventures | 2 | speaking | person | unrelated | 0.10 | 30.0 | yes | 1 | Low — activity outside your space |
| Mark Kahn | Omnivore | 2 | speaking | person | unrelated | 0.10 | 30.0 | yes | 1 | Low — activity outside your space |
| Harsh Deodhar | Enrission India Capital | 2 | speaking | person | unrelated | 0.10 | 30.0 | yes | 1 | Low — activity outside your space |
| Rajinder Balaraman | Z47 | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Krishnan Neelakantan | Ankur Capital | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Vishesh Rajaram | Speciale Invest | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Madhukar Bhatia | Pentathlon Ventures | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Manav Garg | Together Fund | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Rohit Bansal | Titan Capital | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Girish Shivani | YourNest | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Prachi Sinha | Axilor Ventures | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Aditya Singh | All In Capital | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Pranav Pai | 3one4 Capital | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Madhav Tandan | Orios Venture Partners | 0 | — | — | — | — | — | — | — | Quiet — hold |
| Ali Shariff | Mount Judi Ventures | 0 | — | — | — | — | — | — | — | Quiet — hold |
