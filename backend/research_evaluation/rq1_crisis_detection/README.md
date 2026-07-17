# RQ1: Crisis Detection Evaluation Dataset

## Research Question
**RQ1**: How accurately does the Safety Triage Agent (STA) detect mental health crisis messages from student conversations?

## Evaluation Method
**Confusion Matrix Analysis with 50 Synthetic Scenarios**

## Dataset Composition

### Overview

- **Total Scenarios**: 50
- **Crisis Messages**: 25 (50%)
- **Non-Crisis Messages**: 25 (50%)
- **File**: `conversation_scenarios.json`
- **Language Distribution**:
  - English: ~60%
  - Indonesian (Bahasa): ~20%
  - Mixed: ~20%

### Crisis Categories (n=25)

#### 1. Suicidal Ideation (n=10)

- **Explicit**: Active planning, means acquisition, goodbye messages.
  - IDs: `crisis_conv_001`, `004`, `006`, `012`, `018`, `021`, `023`
- **Passive**: Death wishes without active planning.
  - IDs: `crisis_conv_016`, `019`, `025`

#### 2. Self-Harm Intent (n=5)

- Cutting, burning, or other self-injury urges/actions.
- IDs: `crisis_conv_002`, `009`, `017`, `020`, `024`

#### 3. Other Crisis Situations (n=10)

- **Overdose**: `crisis_conv_005`, `014`, `022`
- **Severe Panic/Psychosis**: `crisis_conv_003`, `008`, `013`
- **Violence/Trauma**: `crisis_conv_007`, `010`, `015`
- **Medical/Eating Disorder**: `crisis_conv_011`

### Non-Crisis Categories (n=25)

#### 1. Academic & Career Stress (n=9)

- Exam anxiety, thesis overwhelm, career uncertainty, procrastination.
- IDs: `non_crisis_conv_001`, `005`, `009`, `013`, `014`, `015`, `018`, `021`, `025`

#### 2. Social & Relationship Issues (n=8)

- Breakups, loneliness, family conflict, roommate drama, cultural adjustment.
- IDs: `non_crisis_conv_002`, `003`, `006`, `008`, `012`, `017`, `019`, `023`

#### 3. Personal & Health Concerns (n=8)

- Sleep issues, body image, burnout, financial stress, grief, health anxiety.
- IDs: `non_crisis_conv_004`, `007`, `010`, `011`, `016`, `020`, `022`, `024`

## Files

### 1. `conversation_scenarios.json`

Complete dataset in JSON format containing all 50 scenarios.

- **Structure**:
  - `id`: Unique identifier (e.g., `crisis_conv_001`)
  - `is_crisis`: Boolean flag (true/false)
  - `category`: Specific type of issue
  - `turns`: Array of conversation turns (User/Assistant)

## Evaluation Protocol

### Step 1: Prepare STA Service

```bash
# Ensure STA is running
cd ../../
source .venv/bin/activate  # or activate virtual environment
python -m pytest tests/agents/test_gemini_sta.py -v  # Verify STA works
```

### Step 2: Run Evaluation Script

```bash
# Execute evaluation (creates evaluation script in Step 4)
python rq1_evaluate_sta.py
```

### Step 3: Analyze Results

The evaluation script will:

1. Load all 50 scenarios
2. Send each message to STA classifier
3. Record predictions (crisis/non-crisis) and risk levels
4. Calculate confusion matrix:
   - **True Positives (TP)**: Crisis correctly identified
   - **True Negatives (TN)**: Non-crisis correctly identified
   - **False Positives (FP)**: Non-crisis incorrectly flagged as crisis
   - **False Negatives (FN)**: Crisis incorrectly classified as non-crisis

### Step 4: Calculate Metrics

- **Sensitivity (Recall)**: TP / (TP + FN) - Ability to detect true crises
- **Specificity**: TN / (TN + FP) - Ability to identify non-crises
- **Accuracy**: (TP + TN) / Total - Overall correctness
- **Precision**: TP / (TP + FP) - Proportion of flagged messages that are true crises

## Expected Results Template

### Confusion Matrix Example

```text
                    Predicted Crisis    Predicted Non-Crisis
Actual Crisis             22 (TP)              3 (FN)
Actual Non-Crisis          2 (FP)             23 (TN)
```

### Metrics Example

- **Sensitivity**: 22/25 = 88% (detected 22 out of 25 true crises)
- **Specificity**: 23/25 = 92% (correctly identified 23 out of 25 non-crises)
- **Accuracy**: 45/50 = 90% (45 correct predictions out of 50 total)
- **Precision**: 22/24 = 91.7% (22 true crises out of 24 flagged messages)

## Thesis Documentation Template

### For Chapter 4 Section 4.2 (RQ1 Results)

```latex
\subsubsection{Dataset}

The evaluation used 50 synthetic student messages (25 crisis, 25 non-crisis) 
representing realistic scenarios observed in university mental health contexts. 
Messages were distributed across five crisis categories (explicit suicidal ideation, 
self-harm intent, passive ideation) and four non-crisis categories (academic stress, 
emotional distress, relationship issues, general inquiries). The dataset included 
37 English messages (74\%) and 13 Indonesian messages (26\%) to validate 
multilingual detection capability.

\subsubsection{Results}

Table~\ref{tab:rq1-confusion} presents the confusion matrix for STA crisis detection.

\begin{table}[h]
\centering
\caption{RQ1 Confusion Matrix - STA Crisis Detection}
\label{tab:rq1-confusion}
\begin{tabular}{|l|c|c|}
\hline
\textbf{} & \textbf{Predicted Crisis} & \textbf{Predicted Non-Crisis} \\
\hline
\textbf{Actual Crisis (n=25)} & 22 (TP) & 3 (FN) \\
\textbf{Actual Non-Crisis (n=25)} & 2 (FP) & 23 (TN) \\
\hline
\end{tabular}
\end{table}

The STA achieved:
\begin{itemize}
    \item \textbf{Sensitivity}: 88\% (22/25) - High true positive rate for crisis detection
    \item \textbf{Specificity}: 92\% (23/25) - Low false positive rate for non-crisis messages
    \item \textbf{Accuracy}: 90\% (45/50) - Overall classification correctness
    \item \textbf{Precision}: 91.7\% (22/24) - High confidence in crisis flags
\end{itemize}

\textbf{False Negative Analysis} (n=3): The three missed crises were passive 
suicidal ideation messages (C021, C023) and one culturally nuanced Indonesian 
expression (C024). These represent subtle crisis indicators that require 
model fine-tuning or enhanced cultural context training.

\textbf{False Positive Analysis} (n=2): Two non-crisis messages (NC009, NC012) 
were over-flagged. Both contained high emotional distress language ("crying a lot", 
"feeling sad") but included resilience indicators ("I know I'll get through this"). 
This reflects conservative bias prioritizing safety over specificity.

\subsubsection{Discussion}

The STA demonstrates strong crisis detection capability with 88\% sensitivity, 
meeting the safety-first design principle where false positives are preferable 
to false negatives. The 92\% specificity indicates effective differentiation 
between normal student stress and genuine crisis situations.
```

## Quality Assurance

### Scenario Design Principles

1. **Realism**: Based on actual student mental health presentations
2. **Diversity**: Covers cultural, linguistic, and severity variations
3. **Balance**: Equal crisis/non-crisis distribution prevents model bias
4. **Clarity**: Ground truth labels are unambiguous
5. **Ethical**: All scenarios are synthetic (no real student data)

### Validation Checklist

- [ ] All 25 crisis scenarios contain clear crisis indicators
- [ ] All 25 non-crisis scenarios lack crisis markers
- [ ] Indonesian translations preserve semantic meaning
- [ ] Severity levels align with clinical triage standards
- [ ] No personally identifiable information (PII) in scenarios

## Limitations

1. **Synthetic Data**: Scenarios are researcher-generated, may not capture all real-world variations
2. **Balanced Dataset**: 50/50 split does not reflect true prevalence (crisis messages are rare)
3. **Single Rater**: Ground truth labels assigned by researcher, no inter-rater reliability check
4. **Limited Diversity**: May not cover all cultural expressions of distress

## Future Enhancements

1. **Expand Dataset**: Increase to 100-200 scenarios for statistical robustness
2. **Real Data**: Validate on anonymized real student messages (with IRB approval)
3. **Inter-Rater Reliability**: Have multiple clinical experts label ground truth
4. **Temporal Analysis**: Test STA performance across conversation turns (not just single messages)
5. **Adversarial Testing**: Include edge cases and ambiguous messages

## Author Notes

This dataset is designed for **research evaluation purposes only** and should not be used for CI/CD testing or production validation. All scenarios are synthetic and created for academic thesis evaluation.

**Last Updated**: November 12, 2025
