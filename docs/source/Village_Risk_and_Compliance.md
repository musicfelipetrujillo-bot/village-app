                                        THE VILLAGE
                                        Risk, Legal & Compliance Framework
                                        Milk Connect · Baby Gear Marketplace · April 2026 · CONFIDENTIAL




                                             ⚠ Read Before Distribu ng
                                             This document is an internal risk assessment, not legal advice. Every sec on marked 'A orney Review Required' MUST
                                             be reviewed by a licensed Florida healthcare and/or consumer protec on a orney before the feature ships.

                                             Do not share this document with external par es without legal counsel review.




                                        Execu ve Summary
                                        The Village is building two features that carry above-average legal and safety exposure compared to standard
                                        consumer apps: (1) Milk Connect, a peer-to-peer breast milk donor marketplace, and (2) Baby Gear
                                        Marketplace, a second-hand baby product exchange. Both features are viable and valuable — but both require
                                        deliberate legal architecture before launch.

                                        The core principle governing both features: The Village must posi on itself as a pla orm/facilitator, never as a
                                        seller, supplier, cer er, or guarantor of the goods exchanged. This dis nc on is the single most important legal
                                        protec on available to the company.


                                             The Pla orm vs. Supplier Dis nc on — Why It Ma ers
                                             Pla orm (what we are): We provide so ware that connects willing par es. We do not sell, store, test, or ship goods.
                                             This posi oning, combined with appropriate Terms of Service, gives us the strongest available liability shield.

                                             Supplier (what we must never become): If we set prices, handle physical goods, make health claims, or guarantee the
                                             quality of milk or products, we become a supplier and lose liability protec ons.

                                             Sec on 230 of the CDA protects pla orms from liability for third-party content — but does NOT protect against product
                                             liability claims or false adver sing if we make guarantees.




                                        Part 1 · Milk Connect
                                        The Legal Landscape

                                        Peer breast milk sharing occupies a complex legal space. Understanding the regulatory environment is essen al
                                        before designing the Trust Badge system, disclaimers, or any veri ca on ow.

                                        1.1 Federal (FDA) Posi on
                                        The FDA does not regulate informal breast milk sharing between private individuals. The FDA does regulate
                                        milk banks (HMBANA-licensed facili es that pasteurize and screen milk). However:

                                                   ●             The FDA has issued public warnings about informal milk sharing due to risks of disease transmission (HIV,
                                                                 CMV, hepa s), bacterial contamina on, and adultera on.




                                                                                                                                                                   tf
                                                                                                                                               ti                       ti
                                                                                                                                     tt   ti
                                                                                                                                ti
                                                                                                                      ti
                                                                                                                      fi   ti
                                                                                                                 ti
                                                                                                            ti
                                                                                                       ti
                                                                                                      tt
                                                                                                 ti
                                                                                       ft   ti
                                                                                  ti
                                                                             ti
                                                                        tf
                                                                   ti
                                                            ti
                                                            ti                                                                                           ti   tt
                                                       ti
                                              fi
                                        ti
                                   ti
                              ti
                         ti
                    ti
               tf
          ti
     ti
tf                                                                                                                                                  fl
                                                               ●        The FDA's warnings create a paper trail that plain a orneys will cite if a baby is harmed by donor milk
                                                                        facilitated through The Village.
                                                               ●        The FDA has not taken enforcement ac on against peer-sharing pla orms, but the regulatory landscape
                                                                        could change.
                                                               ●        Breast milk purchased online has tested posi ve for contamina on in peer-reviewed studies (up to 74% of
                                                                        samples in one 2013 study). This scien c record is the #1 liability risk.


                                                   1.2 Florida State Law
                                                               ●        Florida does not have a statute speci cally criminalizing informal breast milk sharing between private
                                                                        par es.
                                                               ●        Florida Statute 381.0098 governs human milk banks — The Village is not a milk bank and must not operate
                                                                        like one.
                                                               ●        Florida's Decep ve and Unfair Trade Prac ces Act (FDUTPA) applies — any misleading claim about donor
                                                                        veri ca on could trigger FDUTPA liability.
                                                               ●        Florida Department of Health has authority over facili es handling human body uids for compensa on —
                                                                        a orney review needed to con rm The Village's model does not trigger facility licensing requirements.


                                                   1.3 The Trust Badge Problem — Cri cal Risk

                                                    ⚠ Cri cal: Trust Badge Creates Veri ca on Liability
                                                    The Trust Badge system (T1/T2/T3) is the biggest legal risk in the en re app. By crea ng a veri ca on framework, The
                                                    Village implicitly claims that veri ed donors are safer. If a T2 or T3 veri ed donor's milk harms a baby, the plain 's
                                                    a orney will argue:

                                                        1. The Village created a 'veri ca on' system that implied safety

                                                        2. Parents relied on the badge when deciding to use donor milk

                                                        3. The Village is therefore liable for the harm that occurred

                                                    The Trust Badge must be redesigned with a orney input to be a 'documenta on completeness' indicator — NOT a
                                                    safety or health cer ca on. The language must be extremely precise.


                                                               ●        T1/T2/T3 labels must be renamed and reframed — e.g., 'Disclosure Level A/B/C' rather than anything that
                                                                        implies veri ca on of health or safety.
                                                               ●        The badge must never use the words 'veri ed,' 'safe,' 'approved,' 'cer ed,' or 'cleared' in any health or
                                                                        safety context.
                                                               ●        Every badge level must display a prominent disclaimer: 'The Village does not verify, test, or guarantee the
                                                                        safety of donor milk. This badge indicates only that the donor has submi ed the stated documenta on.'


                                                   1.4 Payment for Breast Milk
                                                   Selling breast milk is legal in most US states, including Florida, but carries nuance:

                                                               ●        The Village should not set, suggest, or display recommended prices. Pricing must be en rely between
                                                                        donor and recipient.
                                                               ●        The Village must not process payment for the milk itself. If Stripe is integrated, payments should be labeled
                                                                        as 'compensa on for donor's me and storage costs' — not 'purchase of breast milk.'
                                                               ●        A orney review needed on whether facilita ng compensa on for breast milk triggers FDA 'commercial' use
                                                                        rules or Florida health department oversight.
                                                               ●        Consider: some families will want free sharing only. Consider a 'Gi only' lter to reduce commercial
                                                                        exposure.


                                                   1.5 Milk Connect Risk Matrix




                                                                                                                                                                                                                                            ti
                                                                                                                                                                                                                                  ti   ti
                                                                                                                                                                                                                             ti
                                                                                                                                                                                                                        fi
                                                                                                                                                                                                                   ti
                                                                                                                                                                                                              fl
                                                                                                                                                                                                         ti
                                                                                                                                                                                                    fi
                                                                                                                                                                                               ti
                                                                                                                                                                                               tt
                                                                                                                                                                                          fi
                                                                                                                                                                                     ti
                                                                                                                                                                                tf
                                                                                                                                                                           fi
                                                                                                                                                                      ft
                                                                                                                                                                 ti
                                                                                                                                                            ti
                                                                                                                                                       ti
                                                                                                                                                  ti
                                                                                                                                                  tt
                                                                                                                                             ff
                                                                                                                                        ti
                                                                                                                                   ti
                                                                                                                             ti
                                                                                                                              ti
                                                                                                                        fi
                                                                                                                        ti
                                                                                                                  tt
                                                                                                                   ti
                                                                                                             fi
                                                                                                            fi
                                                                                                       ti
                                                                                                  ti
                                                                                             fi
                                                                                        ti
                                                                              fi   fi
                                                                         ti
                                                                   fi
                                                          ti
                                                   fi
                                              ti
                                    ti   ti
                               ti
                          fi
                     ti
                    ti
               fi
          ti
tt   tt
tt                                                                                                                                                                                                                                               ff
                                                                                                  Risk                                                                Likelihood       Impact             Mi ga on / Ac on
                                                                                                                                                                                                          Comprehensive disclaimer + informed consent
                                                                                                  Baby harmed by donor milk
                                                                                                                                                                      Medium           High               checkbox before ANY contact; a orney-dra ed T&C;
                                                                                                  (contamina on, disease)
                                                                                                                                                                                                          recommend pasteuriza on; crisis protocol
                                                                                                                                                                                                          Rename ers; add prominent 'not a health
                                                                                                  Trust Badge creates false sense of
                                                                                                                                                                      High             High               cer ca on' disclaimer; a orney review of all badge
                                                                                                  safety
                                                                                                                                                                                                          language before launch
                                                                                                  Pla orm classi ed as milk bank                                                                          Ensure Village never stores, tests, ships, or prices milk;
                                                                                                                                                                      Low              High
                                                                                                  requiring license                                                                                       posi on as peer-to-peer classi eds only
                                                                                                  FDUTPA claim for misleading                                                                             All veri ca on language reviewed by a orney; no
                                                                                                                                                                      Medium           High
                                                                                                  veri ca on                                                                                              safety claims; only document completeness claims
                                                                                                  Fraudulent donor lis ngs (milk not                                                                      Report mechanism; community modera on; no
                                                                                                                                                                      Medium           Medium
                                                                                                  actually donor's)                                                                                       immunity for fraud under Sec on 230
                                                                                                  Privacy breach of donor health                                                                          Supabase RLS; health data never in URL params;
                                                                                                                                                                      Low              High
                                                                                                  informa on                                                                                              a orney review of data handling under FL health
                                                                                                                                                                                                          privacy law
                                                                                                  Donor's infant a ected (oversupply                                                                      Recommend donors consult pediatrician; add
                                                                                                                                                                      Low              Medium
                                                                                                  misjudged)                                                                                              ques onnaire warning about minimum supply
                                                                                                                                                                                                          thresholds




                                                                                             1.6 Required Mi ga ons Before Milk Connect Launches

                                                                                                  Non-Nego able Requirements — Milk Connect
                                                                                                  1. ATTORNEY REVIEW: Trust Badge naming, language, and disclaimer before any public-facing copy is nalized

                                                                                                  2. ATTORNEY REVIEW: Terms of Service for donor-recipient transac ons (indemni ca on, assump on of risk, dispute
                                                                                                  resolu on)

                                                                                                  3. INFORMED CONSENT: Mul -step consent ow (not just a checkbox) that recipients must complete before viewing any
                                                                                                  donor contact info

                                                                                                  4. DISCLAIMER PLACEMENT: Full disclaimer on every donor lis ng — not just in T&C — visible without scrolling

                                                                                                  5. CRISIS PROTOCOL: De ne what The Village does if a caregiver reports a health incident involving donor milk

                                                                                                  6. INSURANCE: General liability + errors & omissions insurance required before launch; brief insurance broker on the
                                                                                                  feature

                                                                                                  7. PEDIATRICIAN REFERRAL: Every screen must recommend consul ng a pediatrician before using donor milk

                                                                                                  8. NO PRICE SUGGESTION: Remove all price sugges ons, ranges, or 'typical rates' from any app copy




                                                                                             Part 2 · Baby Gear Marketplace
                                                                                             The Legal Landscape

                                                                                             A second-hand baby gear marketplace is a more established business model (Facebook Marketplace, eBay,
                                                                                             O erUp all operate versions of this). However, baby products carry unique hazards because they involve infants
                                                                                             — the most legally protected consumer class. The CPSC (Consumer Product Safety Commission) ac vely




                                                                                                                                                                                                                                 ti
                                                                                                                                                                                                                          fi
                                                                                                                                                                                                                     ti
                                                                                                                                                                                                     ti
                                                                                                                                                                                                fi
                                                                                                                                                                             ti   ti
                                                                                                                                                                      ti
                                                                                                                                                                 ti
                                                                                                                                                            fl
                                                                                                                                                       ft
                                                                                                                                                  ti
                                                                                                                                             tt
                                                                                                                                        tt
                                                                                                                                   fi
                                                                                                                                  ti
                                                                                                                        ti   ti
                                                                                                                   tt
                                                                                                              ti
                                                                                                         fi
                                                                                                    ti
                                                                                             ti
                                                                                        ff
                                                                              fi   ti
                                                                         ti
                                                                        ti
                                                                   ti
                                                        ti
                                                         ti   ti
                                              fi   ti
                                    ti   ti
                               ti
                              fi
                    fi   ti
           tf  ti
          ti
tt   ff
                                                                monitors online resale pla orms.

                                                                2.1 CPSC and Recalled Products — The #1 Risk
                                                                    Federal Law: Selling Recalled Products is Illegal
                                                                    The Consumer Product Safety Improvement Act (CPSIA) makes it unlawful to sell, resell, or distribute recalled consumer
                                                                    products. This applies to individuals AND pla orms.

                                                                    The CPSC has taken ac on against online resellers and pla orms. In 2022, the CPSC sued a reseller for lis ng recalled
                                                                    infant products on Amazon.

                                                                    The Village MUST have a mechanism to: (1) check lis ngs against the CPSC recall database, (2) automa cally ag or
                                                                    block recalled products, and (3) no fy sellers when their listed item is recalled post-lis ng.


                                                                          ●             CPSC Recall API: CPSC provides a public API at recalls.gov. Every lis ng should be cross-checked at
                                                                                        submission me and periodically re-checked.
                                                                          ●             Prohibited items policy must be wri en, published, and ac vely enforced — not just a checkbox in T&C.
                                                                          ●             The Village needs a DMCA-style takedown process for recalled product reports.


                                                                2.2 Prohibited Items List — Mandatory
                                                                The following categories must be explicitly prohibited in the marketplace terms and enforced in the lis ng ow:


                                                                    Category                                              Why Prohibited                                              Legal / Safety Basis
                                                                                                                          Banned federally in 2011 due to strangula on
                                                                    Drop-side cribs (pre-2011)                                                                                        CPSC Final Rule 16 CFR 1219
                                                                                                                          deaths
                                                                                                                          Illegal to resell recalled products; invisible crash
                                                                    Recalled car seats                                                                                                CPSIA; CPSC Recall Database
                                                                                                                          damage
                                                                    Any recalled product                                  Federal law prohibits resale of recalled goods              CPSIA Sec on 19
                                                                    Infant sleep posi oners                               Linked to infant deaths; majority recalled                  CPSC + FDA joint warning
                                                                    Inclined sleepers (>10°
                                                                                                                          Class ac on li ga on; linked to deaths                      CPSC 2019 ruling
                                                                    incline)
                                                                                                                          Structural integrity degrades; manufacturer-set
                                                                    Expired car seats                                                                                                 Manufacturer guidelines
                                                                                                                          expira on
                                                                    Helmets (any type)                                    Invisible impact damage; lifecycle expira on                CPSC + manufacturer guidance
                                                                                                                          FDA classi es as single-user medical devices —
                                                                    Breast pumps                                                                                                      FDA 21 CFR Part 880
                                                                                                                          resale violates FDA guidance
                                                                    Lead-painted toys                                     Federal prohibi on on lead paint in children's
                                                                                                                                                                                      CPSIA
                                                                    (pre-1978)                                            products
                                                                    Modi ed/DIY safety                                    No safety cer       ca on; unknown failure modes            CPSC general authority
                                                                    products

                                                                2.3 Breast Pump Resale — Separate Note
                                                                    Breast Pumps Cannot Be Listed in the Gear Marketplace
                                                                    The FDA classi es breast pumps as single-user medical devices (Class II). Reselling a used breast pump exposes the
                                                                    buyer to contamina on risk (internal tubing cannot be fully sani zed) and violates FDA guidance.

                                                                    This creates a con ict: Milk Connect users may naturally want to also sell or give away their pump. The Village must
                                                                    explicitly prohibit pump lis ngs in the gear marketplace and add a note explaining why — this actually builds trust with
                                                                    safety-conscious mothers.




                                                                                                                                                                                       ti
                                                                                                                                                                                 ti
                                                                                                                                                              ti
                                                                                                                                              ti
                                                                                                                                         ti
                                                                                                                                    ti
                                                                                                                               tf
                                                                                                                     ti
                                                                                                                tf
                                                                                                           ti
                                                                                                      ti                                                                                    fl
                                                                                            ti
                                                                                   tf
                                                                              ti
                                                                     ti
                                                               ti
                                                         fl
                                                          ti
                                                    ti
                                                   ti
                                         fi   ti
                                    fi
                               ti
                          ti
                     ti
                fi
               ti
          ti
     ti
fi                                                                                                                                                                                               ti   fl
                                                                                                 tt
                                                                                               2.4 Pla orm Liability for Marketplace Transac ons
                                                                                               Sec on 230 of the Communica ons Decency Act provides broad immunity to pla orms for third-party content
                                                                                               — but this protec on has limits in product liability contexts. Recent case law is evolving:

                                                                                                               ●                  Oberdorf v. Amazon (3rd Cir. 2019): Court found Amazon could be held liable as a 'seller' under state
                                                                                                                                  product liability law even for third-party marketplace lis ngs.
                                                                                                               ●                  Bolger v. Amazon (Cal. Court of Appeal 2020): Amazon held liable under California strict product liability for
                                                                                                                                  a defec ve lamp sold by a third-party marketplace seller.
                                                                                                               ●                  Key takeaway: The Village should consult Florida counsel on whether Florida product liability law could
                                                                                                                                  reach the pla orm for third-party seller lis ngs.
                                                                                                               ●                  Mi ga on: Make clear in T&C that The Village is not the seller, does not inspect products, and buyers
                                                                                                                                  transact at their own risk — but note this alone does not eliminate all liability.


                                                                                               2.5 Safe Transac on Protocol — Required
                                                                                               The marketplace facilitates strangers mee ng for local pickup. The Village has a duty of care to advise safe
                                                                                               mee ng prac ces:

                                                                                                               ●                  Recommended mee ng loca ons: police sta on parking lots, public libraries, busy co ee shops — never a
                                                                                                                                  private home for ini al transac on.
                                                                                                               ●                  Never meet alone — bring another adult.
                                                                                                               ●                  Transac on should happen in daylight.
                                                                                                               ●                  Cash is safest for in-person transac ons; Venmo/Zelle to known individuals only.
                                                                                                               ●                  The Village should NOT process payments for gear transac ons at MVP — this creates FinCEN money
                                                                                                                                  transmi er licensing obliga ons. Use Stripe only if we become a proper marketplace escrow in v2.


                                                                                               2.6 Baby Gear Marketplace Risk Matrix

                                                                                                    Risk                                                                                                     Likelihood   Impact   Mi ga on / Ac on
                                                                                                                                                                                                                                   CPSC API integra on; prohibited items blocking;
                                                                                                    Baby injured by a recalled product
                                                                                                                                                                                                             Medium       High     mandatory recall acknowledgment from sellers;
                                                                                                    listed on pla orm
                                                                                                                                                                                                                                   a orney review of T&C
                                                                                                    CPSC enforcement ac on for                                                                                                     Proac ve recall database check; clear prohibited items
                                                                                                                                                                                                             Low          High
                                                                                                    facilita ng recalled product sales                                                                                             policy; CPSC-style takedown process
                                                                                                    Pla orm classi ed as product seller                                                                                            Never process payments for goods; never handle/
                                                                                                                                                                                                             Medium       High
                                                                                                    under state law                                                                                                                inspect products; strong T&C with pla orm-only
                                                                                                                                                                                                                                   language
                                                                                                    Expired/damaged car seat causes                                                                                                Explicitly prohibit; add expira on date eld to lis ng;
                                                                                                                                                                                                             Low          High
                                                                                                    injury                                                                                                                         educa onal banner on all car seat lis ngs
                                                                                                    Breast pump resale causes health                                                                                               Explicitly prohibit breast pumps in all marketplace
                                                                                                                                                                                                             Medium       High
                                                                                                    harm                                                                                                                           copy; add educa onal note explaining FDA single-use
                                                                                                                                                                                                                                   rule
                                                                                                    Fraud / scam transac ons (fake                                                                                                 Phone OTP veri ca on for sellers; community
                                                                                                                                                                                                             Medium       Medium
                                                                                                    lis ngs, payment fraud)                                                                                                        repor ng; never store payment data on The Village
                                                                                                                                                                                                                                   servers
                                                                                                    Privacy risk (strangers mee ng for                                                                                             Safe mee ng guide mandatory during lis ng ow;
                                                                                                                                                                                                             Medium       Medium
                                                                                                    pickup)                                                                                                                        never show home address publicly
                                                                                                    FinCEN money transmi er obliga on                                                                                              Do NOT process gear payments at MVP; facilitate cash
                                                                                                                                                                                                             High         High
                                                                                                    if payments processed                                                                                                          or direct P2P payment only




                                                                                                                                                                          ti                                                          ff
                                                                                                                                       ti        ti
                                                                                                                                  ti                  ti
                                                                                                                                                      ti
                                                                                                                             ti                            tf   fi   ti
                                                                                                                        ti                                                     fl
                                                                                                                   ti                                                               ti
                                                                                                          tt                                                                             ti   ti
                                                                                                     ti                                                                                            ti
                                                                                                ti                                                                                                      ti
                                                                                                     ti                                                                                                      ti
                                                                                                ti                                                                                                                                   tf
                                                                                               ti
                                                                                     ti   ti
                                                                                ti
                                                                               ti
                                                                          fi
                                                                    fi    ti
                                                                     ti
                                                               tf
                                                          tf
                                                     ti
                                                    tf
                                               tt
                                               ti
                                    ti
                                     ti   ti
                          ti   ti
                          ti        ti
                     ti
                ti
           tf
          ti
          ti
     ti
tt                                                                                                                                          ti
                                                              2.7 Required Mi ga ons Before Gear Marketplace Launches

                                                                   Non-Nego able Requirements — Baby Gear Marketplace
                                                                   1. CPSC RECALL CHECK: Integrate CPSC Recall API (recalls.gov) to check every lis ng category against current recalls at
                                                                   submission

                                                                   2. ATTORNEY REVIEW: Terms of Service covering pla orm-only posi oning, no-warranty disclaimer, seller
                                                                   representa ons, and indemni ca on

                                                                   3. PROHIBITED ITEMS POLICY: Wri en policy published in app and on web; enforced with category blocking in the lis ng
                                                                   form (not just a checkbox)

                                                                   4. CAR SEAT POLICY: Special warning on all car seat lis ngs: expira on date required, accident history declara on
                                                                   required, no recalled models

                                                                   5. NO PAYMENT PROCESSING: Do not process payments for gear at MVP — facilitate cash/P2P only to avoid FinCEN
                                                                   money transmi er licensing

                                                                   6. SAFE MEETING GUIDE: Mandatory 'how to meet safely' screen before any seller contact info is revealed

                                                                   7. REPORTING MECHANISM: In-app 'Report this lis ng' available on every lis ng; 24hr human review of agged items

                                                                   8. INSURANCE: Con rm with broker that general liability policy covers marketplace facilita on




                                                              Part 3 · Cross-Cu ng Legal Requirements

                                                              3.1 Terms of Service Architecture
                                                              The Village needs three dis nct legal documents, each with speci c func ons:


                                                                   Document                                Purpose                                        Key Clauses                                       A orney Review?
                                                                                                                                                          Pla orm-only disclaimer; governing law
                                                                   General Terms of                        Pla orm use agreement for
                                                                                                                                                          (FL); dispute resolu on; account                  Required
                                                                   Service                                 all users
                                                                                                                                                          termina on
                                                                                                                                                          Assump on of risk; no health guarantee;
                                                                   Milk Connect                            Donor-recipient transac on                                                                       Required — highest
                                                                                                                                                          indemni ca on; pediatrician
                                                                   Addendum                                rules                                                                                            priority
                                                                                                                                                          recommenda on; Trust Badge disclaimer
                                                                                                                                                          No recalled products; seller
                                                                   Gear Marketplace                        Seller-buyer transac on
                                                                                                                                                          representa ons; pla orm not a seller;             Required
                                                                   Addendum                                rules
                                                                                                                                                          safe mee ng advisory
                                                                                                           Data handling for loca on +                    Loca on data usage; health-adjacent               Required — FDUTPA
                                                                   Privacy Policy
                                                                                                           health data                                    data; sharing with third par es; data             + Florida privacy law
                                                                                                                                                          dele on

                                                              3.2 Informed Consent Flows — Design Requirements
                                                              Standard 'I agree to the Terms' checkboxes are insu cient for Milk Connect. Courts give greater weight to
                                                              informed consent when users are required to ac vely engage with the risk disclosure. Required design pa ern
                                                              for Milk Connect:




                                                                                                                                                                                                       tt
                                                                                                                                                                                                  ti
                                                                                                                                                                                          ti
                                                                                                                                                                                     fl
                                                                                                                                                                        ti
                                                                                                                                                                 ti
                                                                                                                                                            ti
                                                                                                                                                     ti
                                                                                                                                                fi
                                                                                                                                           ti
                                                                                                                                      ti
                                                                                                                                ffi
                                                                                                                          ti
                                                                                                                           ti
                                                                                                                     tf
                                                                                                                ti
                                                                                                      tt
                                                                                                 ti
                                                                                            ti
                                                                                            ti
                                                                                       fi
                                                                                       tti
                                                                                  ti
                                                                             ti
                                                                        ti
                                                                   ti
                                                              tf
                                                              ti
                                                    ti   fi
                                               tt
                                          ti
                                     ti
                                    ti
                               ti
                               ti
                          ti
                     fi
                ti
                ti
           ti
          ti
     tf
     tf
tt
                                                                  ●              Step 1: Full-screen risk disclosure — FDA warning language, contamina on risk sta s cs, recommenda on
                                                                                 to consult pediatrician. User must scroll to bo om.
                                                                  ●              Step 2: Explicit acknowledgment ques ons (not just a checkbox): 'I understand The Village does not test,
                                                                                 screen, or guarantee the safety of donor milk.' 'I have consulted or will consult my pediatrician before using
                                                                                 donor milk.' 'I accept all risks associated with informal milk sharing.'
                                                                  ●              Step 3: Timestamp and version of consent stored in Supabase — cri cal for legal defense.
                                                                  ●              Step 4: This consent ow repeats if Terms are updated materially.


                                              3.3 Insurance Requirements
                                                                                                                                                                  Es mated Annual
                                                   Policy Type                                                      Why Needed                                                           Required Before?
                                                                                                                                                                  Premium
                                                                                                                    Bodily injury or property damage
                                                   General Liability ($1M/$2M)                                                                                    $500–1,500/yr          Beta launch
                                                                                                                    claims from any app ac vity
                                                   Errors & Omissions / Tech                                        Claims that The Village's so ware
                                                                                                                                                                  $1,000–3,000/yr        Beta launch
                                                   E&O                                                              caused harm or loss
                                                                                                                    Data breach covering loca on + health-
                                                   Cyber Liability                                                                                                $800–2,000/yr          Public launch
                                                                                                                    adjacent data
                                                                                                                    Protects founders from personal
                                                   Directors & O cers (D&O)                                                                                       $1,500–4,000/yr        Series A
                                                                                                                    liability in lawsuits
                                                                                                                    Protec on against fraudulent
                                                   Commercial crime / fraud                                                                                       Discuss with broker    Marketplace launch
                                                                                                                    marketplace transac ons


                                              3.4 A orney Review Checklist — Priority Order

                                                   Priority                           Item                                                                             Deadline          Est. A orney Cost
                                                                                                                                                                       Before Milk
                                                                                      Trust Badge redesign — rename ers, rewrite all language, add
                                                   P0                                                                                                                  Connect feature $500–1,500
                                                                                      mandatory disclaimers. This cannot launch as currently designed.
                                                                                                                                                                       freeze
                                                                                                                                                                       Before any beta
                                                                                      Milk Connect Terms Addendum — assump on of risk,
                                                   P0                                                                                                                  user touches      $1,000–2,500
                                                                                      indemni ca on, informed consent ow
                                                                                                                                                                       Milk Connect
                                                                                      Privacy Policy — loca on data, health-adjacent data, Florida                     Before public
                                                   P0                                                                                                                                    $800–1,500
                                                                                      Digital Bill of Rights compliance                                                beta
                                                                                                                                                                       Before Gear
                                                                                      Gear Marketplace Terms Addendum — no-warranty, seller
                                                   P1                                                                                                                  Marketplace       $800–1,500
                                                                                      representa ons, CPSC compliance
                                                                                                                                                                       beta
                                                                                                                                                                       Before App
                                                                                      FDUTPA review of all marke ng copy and in-app claims (especially
                                                   P1                                                                                                                  Store             $500–1,000
                                                                                      any veri ca on or safety language)
                                                                                                                                                                       submission
                                                                                      Florida Dept. of Health review — con rm Milk Connect does not                    Before public
                                                   P1                                                                                                                                    $1,000–2,000
                                                                                      trigger facility licensing                                                       launch
                                                                                                                                                                       Before Gear
                                                                                      CPSC compliance review for Gear Marketplace prohibited items
                                                   P2                                                                                                                  Marketplace       $500–1,000
                                                                                      policy
                                                                                                                                                                       public launch
                                                                                      App Store health data safety form — Apple requires accurate                      Before iOS
                                                   P2                                                                                                                                    $300–500
                                                                                      disclosure of health data collec on                                              submission




                                                                                                          ti
                                                                                                fi                                        ti            ti   ti
                                                                            ti                                                                                                ti
                                                                                                                                     ti
                                                                       ft             ti
                                                                  ti                       fl
                                                             ti                                                tt
                                                   ti                                                ti
                                                        fl
                                              ti
                                        ffi
                              ti   ti
                         ti
               fi   fi
                    tt
     tt   ti
ti                                                                               ti
                                             Part 4 · Baby Gear Marketplace — Product Design Principles

                                             Beyond legal requirements, the gear marketplace should be designed to build trust and di eren ate from
                                             Facebook Marketplace / O erUp. Here are the principles that also happen to reduce legal exposure:

                                             4.1 What to Include at MVP
                                                  Category                                                    Notes                                                   Special Requirements
                                                                                                              High demand; easy to inspect; no safety                 Photo requirement: minimum 4 photos
                                                  Strollers
                                                                                                              expira on in most cases                                 including serial number
                                                                                                              No recalled models; check CPSC database at              CPSC check required; con rm meets
                                                  Bassinets & play yards
                                                                                                              lis ng                                                  current ASTM standards
                                                                                                                                                                      No recalled models (several major recalls
                                                  Baby monitors                                               Low risk category; good seller inventory
                                                                                                                                                                      in 2019–2022)
                                                                                                              Moderate demand; verify not a recalled
                                                  Swings & bouncers                                                                                                   Warning screen for any angled products
                                                                                                              inclined sleeper
                                                  Baby clothing &                                                                                                     Prohibit choking hazards: loose bu ons,
                                                                                                              Safest category; no signi cant regulatory risk
                                                  accessories                                                                                                         drawstrings on infant items
                                                  Feeding gear (bo les,                                                                                               Prohibit drop-side high chairs (recalled);
                                                                                                              Moderate risk; must check for recalled items
                                                  high chairs)                                                                                                        CPSC check
                                                                                                              Ensure age-appropriate labeling; prohibit lead-         Pre-1978 toys prohibited; choking hazard
                                                  Toys
                                                                                                              paint items                                             warnings


                                             4.2 What to Exclude at MVP
                                                  Category                                                      Reason to Exclude at MVP                                           Possible v2?
                                                                                                                High liability (expira on, accident history, recall                v2 with mandatory
                                                  Car seats
                                                                                                                complexity); requires specialized knowledge to inspect             inspec on checklist + recall
                                                                                                                                                                                   check
                                                                                                                Pre-2011 drop-side cribs banned; ma ress rmness is                 v2 with CPSC compliance
                                                  Cribs & ma resses
                                                                                                                CPSC-regulated; high injury history                                check
                                                                                                                FDA single-user medical device — resale violates FDA               Never — educate users in-
                                                  Breast pumps
                                                                                                                guidance                                                           app
                                                  Sleep products > infant use                                   Highly recalled category; regulatory vola lity                     v2 with a orney sign-o
                                                  Baby formula (opened)                                         FDA regulates; contamina on risk; no resale framework              Never
                                                  Medica ons / medical
                                                                                                                FDA regulated; not appropriate for peer marketplace                Never
                                                  devices


                                             4.3 Compe                                            ve Di eren a on — The Safety Angle
                                                  The Village Gear Marketplace Is the Safe Alterna ve to Facebook Marketplace




                                                                                                                                                                            ti
                                                                                                                                                                 ff
                                                                                                                  ti
                                                                                                         fi
                                                                                                    ti
                                                                                             tt
                                                                                       tt
                                                                                        ti
                                                                                  ti
                                                                             ff
                                                                        ti
                                                                   fi
                                                              fi
                                                         ff
                                                    ff
                                             ti
                                        tt
                                   ti
                              ti
                         tt
                    tt
               ti
          ti
     ti
ti
                                          Facebook Marketplace and O erUp have no recall checking, no prohibited items enforcement, and no safe mee ng
                                          guidance. Parents regularly buy recalled products on these pla orms without knowing.

                                          The Village's strict safety policy is a FEATURE, not a liability. Market it that way.

                                          Key message: 'Every lis ng checked against CPSC recall database. Prohibited items blocked automa cally. Safe mee ng
                                          guidance built in. The only baby gear marketplace designed speci cally for new mothers.'

                                          This posi oning protects The Village legally AND creates a strong marke ng di eren ator.




                                         Part 5 · Recommended Next Steps

                                          Week          Ac on                                                                 Owner                  Blocks
                                                        Engage Miami healthcare + consumer protec on a orney;
                                          W1                                                                  Founder                                All P0 items
                                                        brief them on both features
                                                        Do not nalize Trust Badge copy, naming, or design un l
                                          W1                                                                                  Product                Milk Connect launch
                                                        a orney review
                                                        Get insurance quotes: GL + E&O + Cyber. Brief broker
                                          W2                                                                                  Founder                Beta launch
                                                        speci cally on milk sharing and marketplace facilita on
                                                        Integrate CPSC Recall API into gear marketplace lis ng
                                          W2                                                                                  Engineer               Gear Marketplace beta
                                                          ow as a proof of concept
                                                        Dra Milk Connect informed consent ow (mul -step, not
                                          W3                                                                                  Product + Legal        Milk Connect beta
                                                        checkbox) for a orney review
                                                        Write prohibited items policy; have a orney review
                                          W3                                                                                  Founder + Legal        Gear Marketplace beta
                                                        before publishing
                                                        A orney-reviewed Privacy Policy live on website before
                                          W4                                                                                  Legal                  Apple App Store submission
                                                        any beta user signs up
                                                        Gear Marketplace MVP with CPSC check, prohibited items
                                          M2                                                                                  Engineer               Public launch
                                                        blocking, and safe mee ng guide



                                         The Village · Risk, Legal & Compliance Framework · April 2026 · CONFIDENTIAL — Do Not Distribute Without Legal Review




                                                                  fl        ti                                 ti
                                                                                                          fi
                                                                                                     tf
                                                                                                ti
                                                                                           ti
                                                                                 ti   tt                                 ti
                                                                       ti                                                             ti
                                                             tt
                                                   ff
                                             ti
                                            ti
                                    tt
                               ti
                          fi
                     fi
                ft
           ti
      tt                                                                                                                                        ti
     tt
fl                                                                                                                                                    ti
                                                                                                                    ff
