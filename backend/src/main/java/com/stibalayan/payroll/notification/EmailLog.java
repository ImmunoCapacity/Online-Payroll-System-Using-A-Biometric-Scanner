package com.stibalayan.payroll.notification;

import com.stibalayan.payroll.audit.AuditService;
import org.springframework.stereotype.Service;

/**
 * Every email the system sends (or fails to send) is written to the audit
 * trail under module "Email", so it shows in the Audit Trail and as a
 * notification in the bell (NotificationController) for the roles it
 * concerns:
 *
 *   Payslips emailed / not emailed         Payroll Master
 *   Fingerprint notice emailed / not sent  Payroll Master and Payroll Staff
 *   Reset code emailed                     System Administrator, and the user it was sent to
 */
@Service
public class EmailLog {

    public static final String MODULE = "Email";

    public static final String PAYSLIPS = "Payslips emailed";
    public static final String PAYSLIPS_FAILED = "Payslips not emailed";
    public static final String FINGERPRINT = "Fingerprint notice emailed";
    public static final String FINGERPRINT_FAILED = "Fingerprint notice not sent";
    public static final String RESET_CODE = "Reset code emailed";

    private final AuditService audit;

    public EmailLog(AuditService audit) {
        this.audit = audit;
    }

    public void log(Integer userId, String action, String details) {
        audit.log(userId, MODULE, action, details);
    }
}
