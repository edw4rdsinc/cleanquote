const mockCalendar = {
    getAvailability: () => {
        const availability = {};
        const today = new Date();
        const possibleSlots = ['09:00', '11:00', '13:00', '15:00'];
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            availability[dateString] = possibleSlots.filter(() => Math.random() > 0.3);
        }
        return availability;
    },
};

export default function handler(req, res) {
    res.status(200).json(mockCalendar.getAvailability());
}