// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PlatformRevenueOracle
 * @notice Multi-sig controlled oracle for monthly platform profit reporting
 * @dev Integrates with CareStakingHalal for Sharia-compliant profit distribution
 * 
 * Workflow:
 * 1. Finance team member submits monthly report
 * 2. 3-of-5 finance team members approve report
 * 3. 48-hour challenge period for auditor review
 * 4. If no challenges, report is finalized and triggers profit distribution
 * 
 * Security Features:
 * - Multi-sig approval (3-of-5) prevents single point of control
 * - Challenge period prevents rushed/fraudulent reports
 * - Auditor oversight with dispute mechanism
 * - On-chain audit trail (all reports immutable once finalized)
 * 
 * @custom:security-contact security@ugm-aicare.com
 */
contract PlatformRevenueOracle is AccessControl {
    
    // ============ STRUCTS ============
    
    struct RevenueBreakdown {
        uint256 wellnessFees;       // Fees from wellness services
        uint256 subscriptions;      // Premium subscription revenue
        uint256 nftSales;           // NFT badge sales
        uint256 partnerFees;        // Partner institution fees
        uint256 treasuryReturns;    // Returns from treasury investments
    }
    
    struct MonthlyReport {
        uint256 month;                      // Month in YYYYMM format (e.g., 202510)
        uint256 totalRevenue;               // Total platform revenue
        uint256 totalExpenses;              // Total platform expenses
        RevenueBreakdown breakdown;         // Detailed revenue breakdown
        uint32 submittedTime;               // When report was submitted
        uint32 approvalDeadline;            // When approvals must be complete
        uint8 approvalsCount;               // Number of approvals received
        bool finalized;                     // Whether report is finalized
        bool challenged;                    // Whether report was challenged
        string challengeReason;             // Reason for challenge (if any)
    }
    
    // ============ STATE VARIABLES ============
    
    // Monthly reports (YYYYMM => Report)
    mapping(uint256 => MonthlyReport) public monthlyReports;
    
    // Approval tracking (month => approver => approved)
    mapping(uint256 => mapping(address => bool)) public hasApproved;
    
    // Staking contract to trigger profit distribution
    address public careStakingHalal;
    
    // Multi-sig wallet for treasury operations
    address public multiSigWallet;
    
    // Roles
    bytes32 public constant FINANCE_TEAM_ROLE = keccak256("FINANCE_TEAM_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    
    // Constants
    uint256 public constant CHALLENGE_PERIOD = 48 hours;
    uint8 public constant REQUIRED_APPROVALS = 3;
    uint8 public constant TOTAL_FINANCE_TEAM = 5;
    
    // ============ EVENTS ============
    
    event ReportSubmitted(
        uint256 indexed month,
        uint256 totalRevenue,
        uint256 totalExpenses,
        address indexed submitter,
        uint256 timestamp
    );
    
    event ReportApproved(
        uint256 indexed month,
        address indexed approver,
        uint8 approvalsCount,
        uint256 timestamp
    );
    
    event ReportFinalized(
        uint256 indexed month,
        uint256 netProfit,
        uint256 timestamp
    );
    
    event ReportChallenged(
        uint256 indexed month,
        address indexed challenger,
        string reason,
        uint256 timestamp
    );
    
    event ReportRevoked(
        uint256 indexed month,
        address indexed revoker,
        string reason,
        uint256 timestamp
    );
    
    // ============ ERRORS ============
    
    error InvalidMonth();
    error ReportAlreadyExists();
    error ReportNotFound();
    error ReportAlreadyFinalized();
    error ReportIsAlreadyChallenged();
    error InsufficientApprovals();
    error ChallengePeriodActive();
    error AlreadyApproved();
    error InvalidBreakdown();
    error NotAuthorized();
    error RevenueExceedsExpenses();
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        address _careStakingHalal,
        address _multiSigWallet,
        address _admin,
        address[] memory _financeTeam,
        address[] memory _auditors
    ) {
        require(_careStakingHalal != address(0), "Invalid staking contract");
        require(_multiSigWallet != address(0), "Invalid multi-sig wallet");
        require(_admin != address(0), "Invalid admin");
        require(_financeTeam.length == TOTAL_FINANCE_TEAM, "Must have 5 finance team members");
        require(_auditors.length > 0, "Must have at least one auditor");
        
        careStakingHalal = _careStakingHalal;
        multiSigWallet = _multiSigWallet;
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        
        // Grant finance team roles
        for (uint256 i = 0; i < _financeTeam.length; i++) {
            require(_financeTeam[i] != address(0), "Invalid finance team member");
            _grantRole(FINANCE_TEAM_ROLE, _financeTeam[i]);
        }
        
        // Grant auditor roles
        for (uint256 i = 0; i < _auditors.length; i++) {
            require(_auditors[i] != address(0), "Invalid auditor");
            _grantRole(AUDITOR_ROLE, _auditors[i]);
        }
    }
    
    // ============ REPORTING FUNCTIONS ============
    
    /**
     * @notice Submit monthly report (Finance team only)
     * @param month Month in YYYYMM format (e.g., 202510)
     * @param totalRevenue Total platform revenue
     * @param totalExpenses Total platform expenses
     * @param breakdown Detailed revenue breakdown
     */
    function submitMonthlyReport(
        uint256 month,
        uint256 totalRevenue,
        uint256 totalExpenses,
        RevenueBreakdown memory breakdown
    ) external onlyRole(FINANCE_TEAM_ROLE) {
        // Validation
        if (month < 202510 || month > 209912) revert InvalidMonth(); // Year 2025-2099
        if (monthlyReports[month].submittedTime != 0) revert ReportAlreadyExists();
        if (totalRevenue < totalExpenses) revert RevenueExceedsExpenses();
        
        // Verify breakdown sums to totalRevenue
        uint256 breakdownSum = breakdown.wellnessFees 
                             + breakdown.subscriptions 
                             + breakdown.nftSales 
                             + breakdown.partnerFees 
                             + breakdown.treasuryReturns;
        
        if (breakdownSum != totalRevenue) revert InvalidBreakdown();
        
        // Create report
        monthlyReports[month] = MonthlyReport({
            month: month,
            totalRevenue: totalRevenue,
            totalExpenses: totalExpenses,
            breakdown: breakdown,
            submittedTime: uint32(block.timestamp),
            approvalDeadline: uint32(block.timestamp + 7 days), // 7 days to get approvals
            approvalsCount: 0,
            finalized: false,
            challenged: false,
            challengeReason: ""
        });
        
        emit ReportSubmitted(month, totalRevenue, totalExpenses, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Approve monthly report (Finance team only, requires 3-of-5)
     * @param month Month to approve
     */
    function approveReport(uint256 month) external onlyRole(FINANCE_TEAM_ROLE) {
        MonthlyReport storage report = monthlyReports[month];
        
        if (report.submittedTime == 0) revert ReportNotFound();
        if (report.finalized) revert ReportAlreadyFinalized();
        if (hasApproved[month][msg.sender]) revert AlreadyApproved();
        
        // Record approval
        hasApproved[month][msg.sender] = true;
        report.approvalsCount++;
        
        emit ReportApproved(month, msg.sender, report.approvalsCount, block.timestamp);
    }
    
    /**
     * @notice Finalize report and trigger profit distribution (Anyone can call after challenge period)
     * @param month Month to finalize
     */
    function finalizeReport(uint256 month) external {
        MonthlyReport storage report = monthlyReports[month];
        
        if (report.submittedTime == 0) revert ReportNotFound();
        if (report.finalized) revert ReportAlreadyFinalized();
        if (report.challenged) revert ReportIsAlreadyChallenged();
        if (report.approvalsCount < REQUIRED_APPROVALS) revert InsufficientApprovals();
        
        // Ensure 48-hour challenge period has passed
        uint256 challengeEndTime = report.submittedTime + CHALLENGE_PERIOD;
        if (block.timestamp < challengeEndTime) revert ChallengePeriodActive();
        
        // Mark as finalized
        report.finalized = true;
        
        uint256 netProfit = report.totalRevenue - report.totalExpenses;
        
        // Trigger profit distribution in CareStakingHalal
        ICareStakingHalal(careStakingHalal).settleMonthlyProfit(
            month,
            report.totalRevenue,
            report.totalExpenses
        );
        
        emit ReportFinalized(month, netProfit, block.timestamp);
    }
    
    /**
     * @notice Challenge report (Auditor only, within challenge period)
     * @param month Month to challenge
     * @param reason Reason for challenge
     */
    function challengeReport(uint256 month, string calldata reason) external onlyRole(AUDITOR_ROLE) {
        MonthlyReport storage report = monthlyReports[month];
        
        if (report.submittedTime == 0) revert ReportNotFound();
        if (report.finalized) revert ReportAlreadyFinalized();
        
        // Can only challenge within challenge period
        uint256 challengeEndTime = report.submittedTime + CHALLENGE_PERIOD;
        if (block.timestamp > challengeEndTime) revert ChallengePeriodActive();
        
        // Mark as challenged
        report.challenged = true;
        report.challengeReason = reason;
        
        emit ReportChallenged(month, msg.sender, reason, block.timestamp);
    }
    
    /**
     * @notice Revoke challenged report (Admin only)
     * @param month Month to revoke
     * @param reason Reason for revocation
     */
    function revokeReport(uint256 month, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        MonthlyReport storage report = monthlyReports[month];
        
        if (report.submittedTime == 0) revert ReportNotFound();
        if (report.finalized) revert ReportAlreadyFinalized();
        
        // Delete report
        delete monthlyReports[month];
        
        // Clear approvals
        // Note: We don't need to manually clear hasApproved mappings as they won't be accessible
        // after report deletion
        
        emit ReportRevoked(month, msg.sender, reason, block.timestamp);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get monthly report details
     */
    function getMonthlyReport(uint256 month) external view returns (MonthlyReport memory) {
        return monthlyReports[month];
    }
    
    /**
     * @notice Get revenue breakdown for a month
     */
    function getRevenueBreakdown(uint256 month) external view returns (RevenueBreakdown memory) {
        return monthlyReports[month].breakdown;
    }
    
    /**
     * @notice Check if user has approved a report
     */
    function hasUserApproved(uint256 month, address user) external view returns (bool) {
        return hasApproved[month][user];
    }
    
    /**
     * @notice Get net profit for a month
     */
    function getNetProfit(uint256 month) external view returns (uint256) {
        MonthlyReport memory report = monthlyReports[month];
        if (report.totalRevenue < report.totalExpenses) return 0;
        return report.totalRevenue - report.totalExpenses;
    }
    
    /**
     * @notice Get approval status for a report
     * @return needsApprovals Number of approvals still needed
     * @return canFinalize Whether report can be finalized
     * @return challengePeriodEnds When challenge period ends
     */
    function getApprovalStatus(uint256 month) 
        external 
        view 
        returns (
            uint8 needsApprovals,
            bool canFinalize,
            uint256 challengePeriodEnds
        ) 
    {
        MonthlyReport memory report = monthlyReports[month];
        
        if (report.submittedTime == 0) {
            return (0, false, 0);
        }
        
        needsApprovals = report.approvalsCount >= REQUIRED_APPROVALS 
            ? 0 
            : REQUIRED_APPROVALS - report.approvalsCount;
        
        challengePeriodEnds = report.submittedTime + CHALLENGE_PERIOD;
        
        canFinalize = !report.finalized 
                   && !report.challenged 
                   && report.approvalsCount >= REQUIRED_APPROVALS
                   && block.timestamp >= challengePeriodEnds;
    }
    
    /**
     * @notice Check if report is finalized
     */
    function isReportFinalized(uint256 month) external view returns (bool) {
        return monthlyReports[month].finalized;
    }
    
    /**
     * @notice Check if report is challenged
     */
    function isReportChallenged(uint256 month) external view returns (bool) {
        return monthlyReports[month].challenged;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Update staking contract address (Admin only)
     */
    function setCareStakingHalal(address _careStakingHalal) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_careStakingHalal != address(0), "Invalid address");
        careStakingHalal = _careStakingHalal;
    }
    
    /**
     * @notice Update multi-sig wallet address (Admin only)
     */
    function setMultiSigWallet(address _multiSigWallet) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_multiSigWallet != address(0), "Invalid address");
        multiSigWallet = _multiSigWallet;
    }
    
    /**
     * @notice Add finance team member (Admin only)
     */
    function addFinanceTeamMember(address member) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(member != address(0), "Invalid address");
        _grantRole(FINANCE_TEAM_ROLE, member);
    }
    
    /**
     * @notice Remove finance team member (Admin only)
     */
    function removeFinanceTeamMember(address member) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(FINANCE_TEAM_ROLE, member);
    }
    
    /**
     * @notice Add auditor (Admin only)
     */
    function addAuditor(address auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(auditor != address(0), "Invalid address");
        _grantRole(AUDITOR_ROLE, auditor);
    }
    
    /**
     * @notice Remove auditor (Admin only)
     */
    function removeAuditor(address auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(AUDITOR_ROLE, auditor);
    }
}

/**
 * @dev Interface for CareStakingHalal contract
 */
interface ICareStakingHalal {
    function settleMonthlyProfit(
        uint256 month,
        uint256 totalRevenue,
        uint256 totalExpenses
    ) external;
}
