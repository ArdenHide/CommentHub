import { TestBed } from '@angular/core/testing';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { CommentsRealtimeService } from './comments-realtime.service';

vi.mock('@microsoft/signalr', () => {
  const connection = { on: vi.fn(), start: vi.fn().mockResolvedValue(undefined) };
  const builder = {
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    build: vi.fn(() => connection),
  };

  return {
    HubConnectionBuilder: vi.fn(function HubConnectionBuilder() {
      return builder;
    }),
  };
});

describe('CommentsRealtimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({});
  });

  it('builds the hub connection only once, even if connect() is called again', () => {
    const service = TestBed.inject(CommentsRealtimeService);

    service.connect();
    service.connect();

    expect(HubConnectionBuilder).toHaveBeenCalledTimes(1);
  });

  it('forwards a CommentAdded event from the hub to onCommentAdded', () => {
    const service = TestBed.inject(CommentsRealtimeService);
    const received: unknown[] = [];
    service.onCommentAdded.subscribe((dto) => received.push(dto));

    service.connect();

    const builderInstance = (HubConnectionBuilder as unknown as ReturnType<typeof vi.fn>).mock
      .results[0].value as { build: ReturnType<typeof vi.fn> };
    const connection = builderInstance.build.mock.results[0].value as {
      on: ReturnType<typeof vi.fn>;
    };
    const [, handler] = connection.on.mock.calls[0] as [string, (dto: unknown) => void];

    handler({ id: 1 });

    expect(received).toEqual([{ id: 1 }]);
  });
});
