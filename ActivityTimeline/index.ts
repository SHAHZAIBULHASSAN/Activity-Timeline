import { IInputs, IOutputs } from "./generated/ManifestTypes";
import './css/style.css';

export class ActivityTimeline implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container: HTMLDivElement;
    private activityDataset: ComponentFramework.PropertyTypes.DataSet | undefined;
    private currentViewMode = "monthly"; // Default view mode
    private currentPage = 1; // Current page number
    private pageSize = 5; // Number of records per page
    private eventListeners: (() => void)[] = []; // Store cleanup functions for event listeners

    /**
     * Initialize the control.
     */
    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this.container = container;
    }

    /**
     * Update the view with new data.
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.activityDataset = context.parameters.activityDataset;

        // Check if dataset is empty or required fields are missing
        if (!this.activityDataset || !this.activityDataset.sortedRecordIds || this.activityDataset.sortedRecordIds.length === 0) {
            this.container.innerHTML = `<div class='no-activities'>No activities found</div>`;
            return;
        }

        // Group records by date based on the current view mode
        const groupedRecords = this.groupRecordsByViewMode();

        // Sort groups in descending order
        const sortedGroups = Object.keys(groupedRecords).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        // Determine if pagination should be shown for date groups
        const showDatePagination = sortedGroups.length > 5;

        // Generate the calendar HTML
        const calendarHTML = `
            <div class="view-selector">
                <button id="view-monthly">Monthly</button>
                <button id="view-weekly">Weekly</button>
                <button id="view-yearly">Yearly</button>
                <button id="view-daily">Daily</button>
            </div>
            <div class="calendar-container">
                ${sortedGroups.map((groupKey, index) => {
                    // Paginate date groups if needed
                    if (showDatePagination && index >= (this.currentPage - 1) * this.pageSize && index < this.currentPage * this.pageSize) {
                        const records = groupedRecords[groupKey];

                        return `
                            <div class="calendar-group">
                                <div class="calendar-group-header" data-group="${groupKey}" aria-expanded="false">
                                    <span>${groupKey}</span>
                                    <span class="toggle-icon">▼</span>
                                </div>
                                <div class="calendar-items">
                                    ${records.map((record) => this.renderActivityItem(record)).join("")}
                                </div>
                                ${records.length > 3 ? `
                                    <div class="pagination-controls">
                                        <button id="prev-page-${groupKey}" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>
                                        <span>Page ${this.currentPage} of ${Math.ceil(records.length / this.pageSize)}</span>
                                        <button id="next-page-${groupKey}" ${this.currentPage * this.pageSize >= records.length ? 'disabled' : ''}>Next</button>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    } else if (!showDatePagination) {
                        const records = groupedRecords[groupKey];

                        return `
                            <div class="calendar-group">
                                <div class="calendar-group-header" data-group="${groupKey}" aria-expanded="false">
                                    <span>${groupKey}</span>
                                    <span class="toggle-icon">▼</span>
                                </div>
                                <div class="calendar-items">
                                    ${records.map((record) => this.renderActivityItem(record)).join("")}
                                </div>
                                ${records.length > 3 ? `
                                    <div class="pagination-controls">
                                        <button id="prev-page-${groupKey}" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>
                                        <span>Page ${this.currentPage} of ${Math.ceil(records.length / this.pageSize)}</span>
                                        <button id="next-page-${groupKey}" ${this.currentPage * this.pageSize >= records.length ? 'disabled' : ''}>Next</button>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }
                    return "";
                }).join("")}
                ${showDatePagination ? `
                    <div class="pagination-controls">
                        <button id="prev-date-page" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>
                        <span>Page ${this.currentPage} of ${Math.ceil(sortedGroups.length / this.pageSize)}</span>
                        <button id="next-date-page" ${this.currentPage * this.pageSize >= sortedGroups.length ? 'disabled' : ''}>Next</button>
                    </div>
                ` : ''}
            </div>
        `;

        // Render the calendar
        this.container.innerHTML = calendarHTML;

        // Add event listeners for view mode buttons, group toggles, and pagination
        this.addEventListeners(context);
    }

    /**
     * Paginate records.
     */
    private paginateRecords(records: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[]): ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[] {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = this.currentPage * this.pageSize;
        return records.slice(startIndex, endIndex);
    }

    /**
     * Add event listeners for view mode buttons, group toggles, and pagination.
     */
    private addEventListeners(context: ComponentFramework.Context<IInputs>): void {
        // View mode buttons
        const viewModes = ["monthly", "weekly", "yearly", "daily"];
        viewModes.forEach((mode) => {
            const button = document.getElementById(`view-${mode}`);
            if (button) {
                const handler = () => {
                    this.currentViewMode = mode;
                    this.currentPage = 1; // Reset pagination when switching views
                    this.updateView(context); // Re-render the view
                };
                button.addEventListener('click', handler);
                this.eventListeners.push(() => button.removeEventListener('click', handler));
            }
        });

        // Group toggle headers
        document.querySelectorAll('.calendar-group-header').forEach((header) => {
            const groupKey = header.getAttribute('data-group');
            if (!groupKey) return;

            const itemsContainer = header.nextElementSibling as HTMLElement;
            if (!itemsContainer) return;

            const handler = () => {
                const expanded = header.getAttribute('aria-expanded') === "true";
                header.setAttribute('aria-expanded', String(!expanded));
                itemsContainer.style.maxHeight = expanded ? "0px" : `${itemsContainer.scrollHeight}px`;

                const toggleIcon = header.querySelector('.toggle-icon');
                if (toggleIcon) toggleIcon.textContent = expanded ? "▼" : "▲";
            };

            header.addEventListener('click', handler);
            this.eventListeners.push(() => header.removeEventListener('click', handler));
        });

        // Pagination buttons
        document.querySelectorAll('.pagination-controls button').forEach((button) => {
            if (button.id.startsWith('prev-page')) {
                button.addEventListener('click', () => {
                    this.currentPage--;
                    this.updateView(context);
                });
            } else if (button.id.startsWith('next-page')) {
                button.addEventListener('click', () => {
                    this.currentPage++;
                    this.updateView(context);
                });
            } else if (button.id === 'prev-date-page') {
                button.addEventListener('click', () => {
                    this.currentPage--;
                    this.updateView(context);
                });
            } else if (button.id === 'next-date-page') {
                button.addEventListener('click', () => {
                    this.currentPage++;
                    this.updateView(context);
                });
            }
        });
    }

    /**
     * Group records based on the current view mode.
     */
    private groupRecordsByViewMode(): Record<string, ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[]> {
        if (!this.activityDataset) return {};

        const groupedRecords: Record<string, ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[]> = {};
        this.activityDataset.sortedRecordIds.forEach((id) => {
            const record = this.activityDataset!.records[id];
            const startDate = record.getFormattedValue("scheduledstart") || "No Start Date";
            let groupKey: string;

            switch (this.currentViewMode) {
                case "monthly":
                    groupKey = this.formatMonth(startDate);
                    break;
                case "weekly":
                    groupKey = this.formatWeek(startDate);
                    break;
                case "yearly":
                    groupKey = this.formatYear(startDate);
                    break;
                case "daily":
                    groupKey = this.formatDate(startDate);
                    break;
                default:
                    groupKey = this.formatMonth(startDate);
            }

            if (!groupedRecords[groupKey]) {
                groupedRecords[groupKey] = [];
            }
            groupedRecords[groupKey].push(record);
        });
        return groupedRecords;
    }

    /**
     * Render individual activity items.
     */
    private renderActivityItem(record: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord): string {
        const subject = record.getFormattedValue("subject") || "No Subject";
        const startDate = record.getFormattedValue("scheduledstart") || "No Start Date";
        const endDate = record.getFormattedValue("scheduledend") || "No End Date";
        const description = record.getFormattedValue("description") || "No Description";

        const statusCode = record.getValue("statuscode") || 0;
        const statusColor = typeof statusCode === "number" ? this.getStatusColor(statusCode) : "#6c757d";

        return `
            <div class="activity-item" style="border-left: 4px solid ${statusColor};">
                <div class="subject">${subject}</div>
                <div class="description">${description}</div>
                <div class="dates">Start: ${startDate}, End: ${endDate}</div>
            </div>
        `;
    }

    /**
     * Helper function to assign colors based on status code.
     */
    private getStatusColor(statusCode: number): string {
        switch (statusCode) {
            case 1: // Completed
                return "#28a745"; // Green
            case 2: // In Progress
                return "#ffc107"; // Yellow
            case 3: // Canceled
                return "#dc3545"; // Red
            default:
                return "#6c757d"; // Gray (Default)
        }
    }

    /**
     * Format date as YYYY-MM-DD.
     */
    private formatDate(dateString: string): string {
        const date = new Date(dateString);
        if (!this.isValidDate(date)) return "Invalid Date";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Format month as YYYY-MM.
     */
    private formatMonth(dateString: string): string {
        const date = new Date(dateString);
        if (!this.isValidDate(date)) return "Invalid Date";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Format year as YYYY.
     */
    private formatYear(dateString: string): string {
        const date = new Date(dateString);
        if (!this.isValidDate(date)) return "Invalid Date";
        return `${date.getFullYear()}`;
    }

    /**
     * Format week as YYYY-WW.
     */
    private formatWeek(dateString: string): string {
        const date = new Date(dateString);
        if (!this.isValidDate(date)) return "Invalid Date";
        const year = date.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }

    /**
     * Validate if a date is valid.
     */
    private isValidDate(date: Date): boolean {
        return !isNaN(date.getTime());
    }

    /**
     * Get outputs (required by the interface).
     */
    public getOutputs(): IOutputs {
        return {};
    }

    /**
     * Clean up resources (required by the interface).
     */
    public destroy(): void {
        this.container.innerHTML = "";
        this.eventListeners.forEach((cleanup) => cleanup());
        this.eventListeners = [];
    }
}