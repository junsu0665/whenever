import SwiftUI
import WidgetKit

private let appGroupIdentifier = "group.com.wenever.app"
private let timetableStorageKey = "wenever.timetable.widget.v1"
private let timetableWidgetKind = "com.wenever.app.timetable"
private let weekdayOrder = ["월", "화", "수", "목", "금"]

struct TimetableWidgetEntry: TimelineEntry {
    let date: Date
    let payload: TimetableWidgetPayload?
}

struct TimetableWidgetPayload: Decodable {
    let schemaVersion: Int
    let generatedAt: String
    let profileName: String
    let schoolName: String
    let grade: Int
    let className: String
    let semesterLabel: String
    let slots: [TimetableWidgetSlot]
}

struct TimetableWidgetSlot: Decodable, Hashable, Identifiable {
    let id: String
    let day: String
    let period: Int
    let startTime: String
    let endTime: String
    let subject: String
    let teacher: String
    let room: String
    let color: String
}

struct TimetableWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> TimetableWidgetEntry {
        TimetableWidgetEntry(date: Date(), payload: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (TimetableWidgetEntry) -> Void) {
        completion(TimetableWidgetEntry(date: Date(), payload: TimetableWidgetStore.load() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TimetableWidgetEntry>) -> Void) {
        let now = Date()
        let entry = TimetableWidgetEntry(date: now, payload: TimetableWidgetStore.load())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

enum TimetableWidgetStore {
    static func load() -> TimetableWidgetPayload? {
        guard
            let defaults = UserDefaults(suiteName: appGroupIdentifier),
            let json = defaults.string(forKey: timetableStorageKey),
            let data = json.data(using: .utf8)
        else {
            return nil
        }

        return try? JSONDecoder().decode(TimetableWidgetPayload.self, from: data)
    }
}

struct TimetableWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TimetableWidgetEntry

    private var model: TimetableWidgetModel {
        TimetableWidgetModel(payload: entry.payload, date: entry.date)
    }

    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                SmallTimetableWidget(model: model)
            case .systemLarge:
                LargeTimetableWidget(model: model)
            default:
                MediumTimetableWidget(model: model)
            }
        }
        .widgetContentBackground(Color.white)
    }
}

struct SmallTimetableWidget: View {
    let model: TimetableWidgetModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeader(model: model)

            Spacer(minLength: 2)

            VStack(alignment: .leading, spacing: 4) {
                Text(model.statusLabel)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Color.primaryGreen)

                Text(model.featuredSlot?.subject ?? model.emptyTitle)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Color.widgetText)
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)

                Text(model.featuredSlot.map(model.detailText(for:)) ?? model.emptySubtitle)
                    .font(.caption)
                    .foregroundStyle(Color.widgetMuted)
                    .lineLimit(1)
            }

            Spacer(minLength: 2)

            if let next = model.secondarySlot {
                Text("\(next.period)교시 \(next.subject)")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Color.widgetMuted)
                    .lineLimit(1)
            }
        }
        .padding(14)
    }
}

struct MediumTimetableWidget: View {
    let model: TimetableWidgetModel

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                WidgetHeader(model: model)

                Spacer(minLength: 0)

                Text(model.statusLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.primaryGreen)

                Text(model.featuredSlot?.subject ?? model.emptyTitle)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Color.widgetText)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)

                Text(model.featuredSlot.map(model.detailText(for:)) ?? model.emptySubtitle)
                    .font(.caption)
                    .foregroundStyle(Color.widgetMuted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 6) {
                ForEach(model.todaySlots.prefix(4)) { slot in
                    TimetableSlotRow(slot: slot, isFeatured: slot.id == model.featuredSlot?.id)
                }
            }
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .padding(14)
    }
}

struct LargeTimetableWidget: View {
    let model: TimetableWidgetModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            WidgetHeader(model: model)

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(model.statusLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.primaryGreen)

                    Text(model.featuredSlot?.subject ?? model.emptyTitle)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(Color.widgetText)
                        .lineLimit(2)

                    Text(model.featuredSlot.map(model.detailText(for:)) ?? model.emptySubtitle)
                        .font(.caption)
                        .foregroundStyle(Color.widgetMuted)
                        .lineLimit(1)
                }

                Spacer()
            }
            .padding(12)
            .background(Color.primarySoft)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(spacing: 7) {
                ForEach(model.todaySlots.prefix(8)) { slot in
                    TimetableSlotRow(slot: slot, isFeatured: slot.id == model.featuredSlot?.id)
                }
            }

            if model.todaySlots.isEmpty {
                Spacer(minLength: 0)
            }
        }
        .padding(16)
    }
}

struct WidgetHeader: View {
    let model: TimetableWidgetModel

    var body: some View {
        HStack(spacing: 7) {
            Text("W")
                .font(.caption.weight(.black))
                .foregroundStyle(Color.white)
                .frame(width: 22, height: 22)
                .background(Color.primaryGreen)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

            VStack(alignment: .leading, spacing: 1) {
                Text(model.dayTitle)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.widgetText)
                    .lineLimit(1)

                Text(model.schoolSubtitle)
                    .font(.caption2)
                    .foregroundStyle(Color.widgetMuted)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
    }
}

struct TimetableSlotRow: View {
    let slot: TimetableWidgetSlot
    let isFeatured: Bool

    var body: some View {
        HStack(spacing: 7) {
            Text("\(slot.period)")
                .font(.caption2.weight(.bold))
                .foregroundStyle(isFeatured ? Color.white : Color.primaryGreen)
                .frame(width: 22, height: 22)
                .background(isFeatured ? Color.primaryGreen : Color.primarySoft)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

            VStack(alignment: .leading, spacing: 1) {
                Text(slot.subject)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.widgetText)
                    .lineLimit(1)

                Text("\(slot.startTime)-\(slot.endTime)")
                    .font(.caption2)
                    .foregroundStyle(Color.widgetMuted)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 5)
        .padding(.horizontal, 7)
        .background(isFeatured ? Color.primarySoft : Color.surfaceAlt)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct TimetableWidgetModel {
    let payload: TimetableWidgetPayload?
    let date: Date

    var dayTitle: String {
        if let dayLabel {
            return "\(dayLabel)요일 시간표"
        }
        return "오늘 시간표"
    }

    var schoolSubtitle: String {
        guard let payload else {
            return "앱을 열어 시간표를 동기화"
        }

        return "\(payload.schoolName) \(payload.grade)-\(payload.className)"
    }

    var dayLabel: String? {
        let weekday = Calendar.current.component(.weekday, from: date)
        switch weekday {
        case 2: return "월"
        case 3: return "화"
        case 4: return "수"
        case 5: return "목"
        case 6: return "금"
        default: return nil
        }
    }

    var todaySlots: [TimetableWidgetSlot] {
        guard let payload, let dayLabel else {
            return []
        }

        return payload.slots
            .filter { $0.day == dayLabel }
            .sorted { $0.period < $1.period }
    }

    var currentSlot: TimetableWidgetSlot? {
        let now = currentMinutes
        return todaySlots.first { slot in
            guard let start = minutes(from: slot.startTime), let end = minutes(from: slot.endTime) else {
                return false
            }

            return start <= now && now < end
        }
    }

    var nextSlot: TimetableWidgetSlot? {
        let now = currentMinutes
        return todaySlots.first { slot in
            guard let start = minutes(from: slot.startTime) else {
                return false
            }

            return start > now
        }
    }

    var featuredSlot: TimetableWidgetSlot? {
        currentSlot ?? nextSlot
    }

    var secondarySlot: TimetableWidgetSlot? {
        guard let featuredSlot else {
            return todaySlots.first
        }

        return todaySlots.first { slot in
            slot.period > featuredSlot.period
        }
    }

    var statusLabel: String {
        if payload == nil {
            return "위젯 준비"
        }
        if currentSlot != nil {
            return "지금 수업"
        }
        if nextSlot != nil {
            return "다음 수업"
        }
        if todaySlots.isEmpty {
            return "수업 없음"
        }
        return "오늘 수업 끝"
    }

    var emptyTitle: String {
        if payload == nil {
            return "시간표 없음"
        }
        if dayLabel == nil {
            return "주말이에요"
        }
        return "등록된 수업 없음"
    }

    var emptySubtitle: String {
        if payload == nil {
            return "앱을 한 번 열면 표시돼요"
        }
        return "앱에서 시간표를 수정해 보세요"
    }

    private var currentMinutes: Int {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (components.hour ?? 0) * 60 + (components.minute ?? 0)
    }

    func detailText(for slot: TimetableWidgetSlot) -> String {
        let roomText = slot.room.isEmpty ? "" : " · \(slot.room)"
        return "\(slot.period)교시 \(slot.startTime)-\(slot.endTime)\(roomText)"
    }

    private func minutes(from value: String) -> Int? {
        let parts = value.split(separator: ":")
        guard parts.count == 2, let hour = Int(parts[0]), let minute = Int(parts[1]) else {
            return nil
        }

        return hour * 60 + minute
    }
}

extension TimetableWidgetPayload {
    private static var placeholderDay: String {
        let index = Calendar.current.component(.weekday, from: Date()) - 2
        guard weekdayOrder.indices.contains(index) else {
            return "월"
        }

        return weekdayOrder[index]
    }

    static let placeholder = TimetableWidgetPayload(
        schemaVersion: 1,
        generatedAt: "",
        profileName: "학생",
        schoolName: "웨네버고",
        grade: 2,
        className: "3",
        semesterLabel: "2026 1학기",
        slots: [
            TimetableWidgetSlot(
                id: "placeholder-1",
                day: placeholderDay,
                period: 1,
                startTime: "08:40",
                endTime: "09:30",
                subject: "국어",
                teacher: "김선생",
                room: "2-3",
                color: "#2FA66B"
            ),
            TimetableWidgetSlot(
                id: "placeholder-2",
                day: placeholderDay,
                period: 2,
                startTime: "09:40",
                endTime: "10:30",
                subject: "수학",
                teacher: "박선생",
                room: "2-3",
                color: "#00845E"
            ),
        ]
    )
}

extension View {
    @ViewBuilder
    func widgetContentBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(color, for: .widget)
        } else {
            background(color)
        }
    }
}

extension Color {
    static let primaryGreen = Color(red: 0.184, green: 0.651, blue: 0.42)
    static let primarySoft = Color(red: 0.914, green: 0.973, blue: 0.941)
    static let surfaceAlt = Color(red: 0.969, green: 0.973, blue: 0.98)
    static let widgetText = Color(red: 0.082, green: 0.102, blue: 0.122)
    static let widgetMuted = Color(red: 0.345, green: 0.388, blue: 0.427)
}

struct WeneverTimetableWidget: Widget {
    let kind = timetableWidgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TimetableWidgetProvider()) { entry in
            TimetableWidgetView(entry: entry)
        }
        .configurationDisplayName("웨네버 시간표")
        .description("오늘 수업과 다음 수업을 홈 화면에서 확인해요.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct WeneverTimetableWidgetBundle: WidgetBundle {
    var body: some Widget {
        WeneverTimetableWidget()
    }
}
