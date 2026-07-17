# Research Evaluation Suite

This directory contains all evaluation datasets, scripts, and test suites for the bachelor's thesis research questions. These materials are **isolated from CI/CD pipelines** and designed exclusively for academic thesis evaluation.

## Project Context

**Thesis Title**: Safety Agent Suite for Proactive Mental Health Support in University Students

**Research Type**: Bachelor's Computer Science (Design Science Research)

**Evaluation Scope**: Simplified proof-of-concept evaluation
- RQ1: 50 synthetic crisis scenarios (confusion matrix)
- RQ2: 10 conversation flows (Langfuse trace analysis)
- RQ3: 10 coaching scenarios (dual-rater assessment)
- RQ4: Code review + 3 unit tests (k-anonymity validation)

## Directory Structure

```
research_evaluation/
├── README.md                          # This file
├── rq1_crisis_detection/              # RQ1: STA accuracy evaluation
│   ├── crisis_scenarios.py            # 50 scenarios (25 crisis, 25 non-crisis)
│   ├── rq1_crisis_scenarios.json      # Generated dataset
│   ├── rq1_crisis_scenarios.csv       # CSV export
│   ├── rq1_evaluate_sta.py            # Evaluation script
│   ├── results/                       # Generated reports
│   └── README.md
│
├── rq2_orchestration/                 # RQ2: Orchestration workflow evaluation
│   ├── orchestration_flows.py         # 10 flows (F1-F10)
│   ├── rq2_orchestration_flows.json   # Flow definitions
│   └── README.md
│
├── rq3_coaching_quality/              # RQ3: TCA intervention quality
│   ├── coaching_scenarios.py          # 10 coaching scenarios
│   ├── rq3_coaching_scenarios.json    # Scenarios + rubric
│   ├── rq3_coaching_scenarios.csv     # CSV export
│   ├── rq3_rating_template.json       # Dual-rater assessment template
│   └── README.md
│
└── rq4_privacy/                       # RQ4: k-anonymity enforcement
    ├── test_ia_k_anonymity.py         # 5 unit tests
    └── README.md
```

## Quick Start

### Step 1: Install Dependencies
```bash
cd backend
python -m pip install -r requirements.txt
```

### Step 2: Generate Datasets (Already Done)
```bash
# RQ1: Crisis scenarios
cd research_evaluation/rq1_crisis_detection
python crisis_scenarios.py  # ✅ Creates rq1_crisis_scenarios.json + .csv

# RQ2: Orchestration flows
cd ../rq2_orchestration
python orchestration_flows.py  # ✅ Creates rq2_orchestration_flows.json

# RQ3: Coaching scenarios
cd ../rq3_coaching_quality
python coaching_scenarios.py  # ✅ Creates rq3_coaching_scenarios.json + rating template
```

### Step 3: Run Evaluations

#### RQ1: Crisis Detection Evaluation
```bash
cd research_evaluation/rq1_crisis_detection
python rq1_evaluate_sta.py

# Output:
# - results/rq1_results_<timestamp>.json
# - results/rq1_results_<timestamp>.csv
# - results/rq1_report_<timestamp>.md
```

#### RQ2: Orchestration Workflow Evaluation
```bash
# 1. Start Langfuse service
cd ../../..  # Back to project root
./dev.sh setup-langfuse

# 2. Access Langfuse UI
# Open: http://localhost:8262
# Create account, project, and generate API keys

# 3. Update .env with Langfuse credentials
LANGFUSE_ENABLED=true
LANGFUSE_HOST=http://localhost:8262
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# 4. Execute flows via API
# Send messages from rq2_orchestration_flows.json to /api/v1/aika

# 5. Analyze traces in Langfuse UI
# Verify: agent invocations, timestamps, state transitions, workflow completion
```

#### RQ3: Coaching Quality Evaluation
```bash
cd research_evaluation/rq3_coaching_quality

# 1. Generate TCA responses (manual or scripted)
# For each scenario in rq3_coaching_scenarios.json:
#   - Send user_message to /api/v1/aika
#   - Capture TCA response

# 2. Dual-rater assessment
# - Researcher rates using rq3_rating_template.json
# - GPT-4 rates same responses (use structured prompt with rubric)

# 3. Calculate inter-rater agreement
# - Average ratings per dimension
# - Calculate overall score
# - Document in thesis Chapter 4 Section 4.4
```

#### RQ4: Privacy Unit Tests
```bash
cd research_evaluation/rq4_privacy

# Run k-anonymity unit tests
pytest test_ia_k_anonymity.py -v

# Expected output:
# test_small_cohort_suppression PASSED         [20%]
# test_compliant_publication PASSED            [40%]
# test_individual_query_blocking PASSED        [60%]
# test_boundary_condition_k_equals_5 PASSED    [80%]
# test_multi_date_suppression_selectivity PASSED [100%]
# ======================== 5 passed in 2.34s ========================
```

## Research Questions Overview

### RQ1: Crisis Detection Accuracy
**Question**: How accurately does the Safety Triage Agent (STA) detect mental health crisis messages?

**Method**: Confusion matrix analysis with 50 synthetic scenarios

**Metrics**:
- Sensitivity (Recall): TP / (TP + FN)
- Specificity: TN / (TN + FP)
- Accuracy: (TP + TN) / Total
- Precision: TP / (TP + FP)

**Dataset**: 25 crisis + 25 non-crisis messages (English 74%, Indonesian 26%)

**Expected Results**: Sensitivity ≥ 85%, Specificity ≥ 90%

---

### RQ2: Orchestration Workflow Validation
**Question**: How effectively does the Aika Meta-Agent orchestrate multi-agent workflows?

**Method**: Langfuse trace analysis with 10 representative flows

**Validation Criteria**:
- All expected agent invocations appear in trace
- Timestamps are sequential
- State transitions captured (risk_level, intervention_type, etc.)
- Workflow completion confirmed

**Flows**:
- F1-F4: Agent routing (STA→TCA, STA→CMA, etc.)
- F5: Analytics query (IA)
- F6: Multi-turn conversation
- F7-F8: Edge cases (non-crisis, boundary refusal)
- F9-F10: Administrative tasks and mixed workflows

**Expected Results**: 10/10 flows complete successfully with correct agent sequences

---

### RQ3: Coaching Quality Assessment
**Question**: How effective are the TCA's CBT-based interventions?

**Method**: Dual-rater assessment (researcher + GPT-4) using structured rubric

**Rubric Dimensions** (5-point Likert scale):
1. Empathy & validation
2. Evidence-based CBT techniques
3. Cultural appropriateness (Indonesian context)
4. Boundary respect (no medical/legal advice)
5. Resource usefulness

**Dataset**: 10 coaching scenarios (stress 3, motivation 3, academic 2, boundary testing 2)

**Expected Results**: Overall score ≥ 4.0/5.0, inter-rater agreement (Cohen's κ or correlation)

---

### RQ4: Privacy k-Anonymity Enforcement
**Question**: How does the Insights Agent ensure k-anonymity (k≥5) in analytics queries?

**Method**: Code review + unit test validation

**Validation**:
1. **Code Review**: Verify all 6 SQL queries contain `HAVING COUNT(...) >= 5`
2. **Unit Tests**: Automated validation of suppression behavior
   - Test 1: Small cohort suppression (n<5)
   - Test 2: Compliant publication (n≥5)
   - Test 3: Individual query blocking

**Expected Results**: 
- ✅ All 6 queries enforce k-anonymity (code review)
- ✅ All 5 unit tests pass (including 2 bonus tests)

## Thesis Integration

### Chapter 4 Section Structure

#### 4.2 RQ1: Crisis Detection Results
```latex
- Dataset description (50 scenarios)
- Confusion matrix table
- Metrics (sensitivity, specificity, accuracy, precision)
- False negative analysis
- False positive analysis
- Discussion
```

#### 4.3 RQ2: Orchestration Results
```latex
- Flow execution summary (10/10 completed)
- Langfuse trace examples (screenshots)
- Agent invocation validation
- State transition analysis
- Discussion
```

#### 4.4 RQ3: Coaching Quality Results
```latex
- Scenario overview (10 scenarios, 4 categories)
- Rubric scores table (5 dimensions)
- Overall scores (researcher vs GPT-4)
- Inter-rater agreement
- Qualitative analysis (strengths/weaknesses)
- Discussion
```

#### 4.5 RQ4: Privacy Validation Results
```latex
- Code review findings (6/6 queries compliant)
- Unit test results table (5/5 passed)
- Privacy mechanisms discussion (allow-listing, aggregation, HAVING clause)
- Limitations and future work
```

## Important Notes

### Isolation from CI/CD
These tests are **NOT** part of the CI/CD pipeline:
- Located in dedicated `research_evaluation/` directory
- Separate from `backend/tests/` (production tests)
- Uses synthetic data only (no production data)
- Designed for one-time academic evaluation

### Data Ethics
- ✅ All scenarios are synthetic (researcher-generated)
- ✅ No real student data used
- ✅ No personally identifiable information (PII)
- ✅ Culturally sensitive language reviewed

### Reproducibility
All datasets and scripts are version-controlled:
- Datasets: JSON + CSV formats
- Scripts: Python 3.11+ compatible
- Dependencies: Listed in `backend/requirements.txt`
- Evaluation date: November 2025

## Troubleshooting

### RQ1 Evaluation Fails
```bash
# Check STA implementation
pytest backend/tests/agents/test_gemini_sta.py -v

# Verify Gemini API key
echo $GOOGLE_GEMINI_API_KEY

# Check database connection
python -c "from app.database import get_async_db; print('DB OK')"
```

### RQ2 Langfuse Not Working
```bash
# Check Langfuse service
docker ps | grep langfuse

# Check environment variables
cat .env | grep LANGFUSE

# Test Langfuse connection
curl http://localhost:8262
```

### RQ3 TCA Responses Missing
```bash
# Verify TCA implementation
pytest backend/tests/agents/test_sca.py -v

# Check LangGraph StateGraph
python -c "from app.agents.sca.sca_graph import sca_graph; print(sca_graph)"
```

### RQ4 Tests Fail
```bash
# Check database fixtures
pytest backend/tests/conftest.py -v

# Verify IA queries
python -c "from app.agents.ia.queries import ALLOWED_QUERIES; print(len(ALLOWED_QUERIES))"

# Run tests with verbose output
pytest research_evaluation/rq4_privacy/test_ia_k_anonymity.py -vv
```

## Timeline Estimate

| Task | Estimated Time | Status |
|------|---------------|--------|
| ✅ Create RQ4 unit tests | 2 hours | COMPLETE |
| ✅ Generate RQ1 crisis scenarios | 1 hour | COMPLETE |
| ✅ Generate RQ2 orchestration flows | 1 hour | COMPLETE |
| ✅ Generate RQ3 coaching scenarios | 1 hour | COMPLETE |
| ⏳ Setup Langfuse infrastructure | 30 minutes | PENDING |
| ⏳ Execute RQ1 evaluation | 30 minutes | PENDING |
| ⏳ Execute RQ2 flows + capture traces | 1 hour | PENDING |
| ⏳ Execute RQ3 + dual rating | 2 hours | PENDING |
| ⏳ Run RQ4 unit tests | 15 minutes | PENDING |
| ⏳ Document results in thesis | 3 hours | PENDING |
| **TOTAL** | **~12 hours** | **33% COMPLETE** |

## Next Steps

1. **[IMMEDIATE]**: Run RQ4 unit tests to verify privacy implementation
   ```bash
   pytest research_evaluation/rq4_privacy/test_ia_k_anonymity.py -v
   ```

2. **[HIGH PRIORITY]**: Setup Langfuse for RQ2 evaluation
   ```bash
   ./dev.sh setup-langfuse
   # Follow prompts to create account and generate API keys
   ```

3. **[MEDIUM PRIORITY]**: Execute RQ1 evaluation
   ```bash
   cd research_evaluation/rq1_crisis_detection
   python rq1_evaluate_sta.py
   ```

4. **[AFTER LANGFUSE]**: Execute RQ2 flows and capture traces

5. **[FINAL STEP]**: Execute RQ3 dual-rater assessment and document results

## Contact & Support

For questions about this evaluation suite:
- **Technical Issues**: Check implementation files in `backend/app/agents/`
- **Dataset Issues**: Review scenario generation scripts in each RQ directory
- **Thesis Integration**: Refer to `PROJECT_SINGLE_SOURCE_OF_TRUTH.md`

**Last Updated**: November 12, 2025

---

*This evaluation suite is designed exclusively for academic thesis research and does not represent production testing standards.*
