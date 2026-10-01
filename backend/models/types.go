package models

type Student struct {
	ID               string `json:"id"`
	RegNo            string `json:"regNo"`
	FullName         string `json:"fullName"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	EmergencyContact string `json:"emergencyContact"`
	Address          string `json:"address"`
	StudyGoal        string `json:"studyGoal"`
	Shift            string `json:"shift"` // morning, afternoon, evening, night, fullday
	SeatType         string `json:"seatType"` // dedicated, flexible
	SeatNumber       string `json:"seatNumber"`
	LockerNumber     string `json:"lockerNumber,omitempty"`
	MembershipPlan   string `json:"membershipPlan"` // daily_pass, monthly, quarterly, half_yearly, yearly
	PlanAmount       int    `json:"planAmount"`
	AmountPaid       int    `json:"amountPaid"`
	AmountDue        int    `json:"amountDue"`
	PaymentStatus    string `json:"paymentStatus"` // paid, partial, pending
	StartDate        string `json:"startDate"`
	EndDate          string `json:"endDate"`
	Status           string `json:"status"` // active, pending, expired, inactive
	RegisteredVia    string `json:"registeredVia"` // online_link, admin_desk
	CreatedAt        string `json:"createdAt"`
	Notes            string `json:"notes,omitempty"`
}

type FeeTransaction struct {
	ID            string `json:"id"`
	StudentID     string `json:"studentId"`
	StudentName   string `json:"studentName"`
	RegNo         string `json:"regNo"`
	Amount        int    `json:"amount"`
	PaymentDate   string `json:"paymentDate"`
	PaymentMode   string `json:"paymentMode"` // upi, cash, card, bank_transfer
	ReceiptNumber string `json:"receiptNumber"`
	Remarks       string `json:"remarks,omitempty"`
}

type LoungeSeat struct {
	ID                 string `json:"id"`
	SeatNumber         string `json:"seatNumber"`
	Type               string `json:"type"` // dedicated, flexible, cabin
	Section            string `json:"section"`
	Status             string `json:"status"` // available, occupied, reserved, maintenance
	CurrentStudentID   string `json:"currentStudentId,omitempty"`
	CurrentStudentName string `json:"currentStudentName,omitempty"`
	Shift              string `json:"shift,omitempty"`
}

type CollectFeeRequest struct {
	StudentID   string `json:"studentId"`
	Amount      int    `json:"amount"`
	PaymentMode string `json:"paymentMode"`
	Remarks     string `json:"remarks"`
}

type AssignSeatRequest struct {
	StudentID  string `json:"studentId"`
	SeatNumber string `json:"seatNumber"`
}

type DashboardStats struct {
	TotalStudents       int            `json:"totalStudents"`
	ActiveStudents      int            `json:"activeStudents"`
	PendingStudents     int            `json:"pendingStudents"`
	TotalSeats          int            `json:"totalSeats"`
	OccupiedSeats       int            `json:"occupiedSeats"`
	AvailableSeats      int            `json:"availableSeats"`
	OccupancyPercentage int            `json:"occupancyPercentage"`
	TotalRevenue        int            `json:"totalRevenue"`
	PendingDues         int            `json:"pendingDues"`
	ShiftDistribution   map[string]int `json:"shiftDistribution"`
}
