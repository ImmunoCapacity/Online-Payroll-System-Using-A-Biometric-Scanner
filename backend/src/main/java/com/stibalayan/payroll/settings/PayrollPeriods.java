package com.stibalayan.payroll.settings;

import java.sql.Date;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Payroll periods (cut-offs), from Maintenance → Payroll Periods.
 *
 * Each rule says on which two days of the month a cut-off starts (e.g. the
 * 11th and the 26th: 11th–25th and 26th–10th of the next month) and from
 * which date it applies. A rule never changes periods before its effective
 * date, so payroll already computed keeps its cut-offs; the last period of
 * the old rule simply ends the day before the new rule starts.
 *
 * Loans are deducted once a month, in the period that has the rule's first
 * start day (the 11th–25th cut-off for 11 and 26).
 *
 * The same logic runs in the browser (js/payroll-periods.js).
 */
@Service
public class PayrollPeriods {

    public static final int MAX_START_DAY = 28;   // every month has it
    private static final DateTimeFormatter MONTH_DAY = DateTimeFormatter.ofPattern("MMMM d", Locale.ENGLISH);

    public record Rule(int id, LocalDate effectiveDate, int firstDay, int secondDay) {
    }

    public record Period(LocalDate start, LocalDate end) {
        public boolean contains(LocalDate d) {
            return !d.isBefore(start) && !d.isAfter(end);
        }
    }

    private final JdbcTemplate jdbc;

    public PayrollPeriods(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Every rule, oldest first. */
    public List<Rule> rules() {
        List<Rule> rules = jdbc.query("SELECT rule_id, effective_date, first_start_day, second_start_day "
                        + "FROM payroll_period_rule ORDER BY effective_date",
                (rs, i) -> new Rule(rs.getInt(1), rs.getDate(2).toLocalDate(), rs.getInt(3), rs.getInt(4)));
        return rules.isEmpty() ? List.of(new Rule(0, LocalDate.of(2000, 1, 1), 11, 26)) : rules;
    }

    public Rule ruleFor(LocalDate d) {
        return ruleFor(rules(), d);
    }

    /** The period that contains a date. */
    public Period period(LocalDate d) {
        return period(rules(), d);
    }

    public Period previous(Period p) {
        return period(p.start().minusDays(1));
    }

    public Period next(Period p) {
        return period(p.end().plusDays(1));
    }

    /** Whether start–end is exactly one payroll period. */
    public boolean isPeriod(LocalDate start, LocalDate end) {
        return period(start).equals(new Period(start, end));
    }

    /** The month whose loan deduction falls in this period (it has the rule's first start day), or null. */
    public YearMonth loanMonth(LocalDate from, LocalDate to) {
        List<Rule> rules = rules();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (d.getDayOfMonth() == ruleFor(rules, d).firstDay()) return YearMonth.from(d);
        }
        return null;
    }

    public String label(Period p) {
        return p.start().format(MONTH_DAY) + (p.start().getYear() == p.end().getYear() ? "" : ", " + p.start().getYear())
                + " – " + p.end().format(MONTH_DAY) + ", " + p.end().getYear();
    }

    // ---------------------------------------------------------------

    static Rule ruleFor(List<Rule> rules, LocalDate d) {
        Rule found = rules.get(0);
        for (Rule r : rules) {
            if (!r.effectiveDate().isAfter(d)) found = r;
        }
        return found;
    }

    static Period period(List<Rule> rules, LocalDate d) {
        Rule r = ruleFor(rules, d);
        LocalDate start = startOn(r, d);
        if (start.isBefore(r.effectiveDate())) start = r.effectiveDate();
        LocalDate end = nextStart(r, start).minusDays(1);
        // A newer rule starting inside this period cuts it short.
        for (Rule later : rules) {
            if (later.effectiveDate().isAfter(start) && !later.effectiveDate().isAfter(end)) {
                end = later.effectiveDate().minusDays(1);
                break;
            }
        }
        return new Period(start, end);
    }

    /** The start of the cut-off that contains d under one rule. */
    static LocalDate startOn(Rule r, LocalDate d) {
        if (d.getDayOfMonth() >= r.secondDay()) return d.withDayOfMonth(r.secondDay());
        if (d.getDayOfMonth() >= r.firstDay()) return d.withDayOfMonth(r.firstDay());
        return d.minusMonths(1).withDayOfMonth(r.secondDay());
    }

    /** The start of the cut-off after the one starting on (or containing) start. */
    static LocalDate nextStart(Rule r, LocalDate start) {
        LocalDate s = startOn(r, start);
        return s.getDayOfMonth() == r.firstDay() ? s.withDayOfMonth(r.secondDay()) : s.plusMonths(1).withDayOfMonth(r.firstDay());
    }

    /** Whether a date is a cut-off start under a rule (an effective date must be one). */
    public static boolean isStartDay(int firstDay, int secondDay, LocalDate d) {
        return d.getDayOfMonth() == firstDay || d.getDayOfMonth() == secondDay;
    }

    /** The latest saved payroll period end, or null. */
    public LocalDate lastSavedPayrollEnd() {
        Date d = jdbc.queryForObject("SELECT MAX(pay_period_end) FROM payroll_run", Date.class);
        return d == null ? null : d.toLocalDate();
    }
}
